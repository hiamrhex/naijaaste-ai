import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { createUser, findUserByEmail, findUserById, sanitize, storeRefreshToken, revokeRefreshToken, revokeAllRefreshTokens, hasRefreshToken, updateUser, setPasswordHash, getFavorites, addFavorite, removeFavorite, upsertGoogleUser, deleteUserAccount } from '../auth/store.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../auth/tokens.js';
import { requireAuth } from '../auth/middleware.js';
import { clientIp } from '../lib/clientIp.js';
import { issueOtp, verifyOtp } from '../auth/otp.js';
import { lockStatus, recordFailure, clearFailures } from '../auth/lockout.js';
import { sendOtpEmail, sinkAddress, otpShownInResponse } from '../services/email.service.js';
import { passwordProblem } from '../auth/password.js';
import { verifyGoogleCredential, googleAuthEnabled } from '../auth/google.js';
import { env } from '../env.js';
import { getRestaurantsByCodes, findRestaurantByCode } from '../db/catalogue.js';
import { createSavedPlace, listSavedPlaces, deleteSavedPlace } from '../saved_places/store.js';
import { fail } from '../lib/respond.js';

const router = Router();

// Auth endpoints use the standard error envelope via fail().
// The SPA reads error.code, error.message, error.requestId from body.error.
// Success responses keep the historical { success: true, ... } envelope.

// Token-bearing responses must never be cached by a proxy or the bfcache.
// Scoped to the auth routes: the router is mounted at "/" as well, so a
// router-wide header would have made every API response uncacheable.
const noStore = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

// One bucket per flow. A shared bucket meant a signup loop could lock a user
// out of sign-in and refresh (and vice versa) - the limit protected the
// server, but the user paid for it.
//
// The bucket is keyed on the IP captured before the body was read: the
// default keyGenerator reads req.ip, which throws on the serverless runtime
// once the body has been consumed (see src/lib/clientIp.js).
const limiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = clientIp(req);
    if (!ip || ip === 'unknown') return 'unknown';
    try {
      return ipKeyGenerator(ip);
    } catch {
      return ip;
    }
  },
  handler: (req, res) => fail(res, {
    status: 429,
    code: 'RATE_LIMITED',
    message,
    requestId: req.id,
    retryAfterSec: Math.ceil(windowMs / 1000),
  }),
});

// Limits are per client IP. They are generous on purpose: Nigerian mobile
// carriers put whole neighbourhoods behind one address (carrier-grade NAT), so
// a tight IP budget locks out innocent neighbours. The precise control is the
// per-(email, ip) lockout below, which cannot be used to lock a victim out.
const signupLimiter = limiter(15 * 60 * 1000, env.AUTH_RATE_LIMIT_SIGNUP_MAX, 'Too many accounts created from this network. Try again in 15 minutes.');
const signinLimiter = limiter(15 * 60 * 1000, env.AUTH_RATE_LIMIT_SIGNIN_MAX, 'Too many sign-in attempts. Try again in 15 minutes.');
// A live tab rehydrates its access token from the cookie on load and on every
// 401, so this bucket has to be generous or long-lived sessions break.
const refreshLimiter = limiter(15 * 60 * 1000, env.AUTH_RATE_LIMIT_REFRESH_MAX, 'Too many session refreshes. Try again in 15 minutes.');
const googleLimiter = limiter(15 * 60 * 1000, env.AUTH_RATE_LIMIT_GOOGLE_MAX, 'Too many Google sign-in attempts. Try again in 15 minutes.');
// Requesting a code and guessing a code are different budgets: a user who
// mistypes their code must not spend the same quota as one who spams requests.
const forgotLimiter = limiter(15 * 60 * 1000, env.AUTH_RATE_LIMIT_FORGOT_MAX, 'Too many reset codes requested. Try again in 15 minutes.');
const resetLimiter = limiter(15 * 60 * 1000, env.AUTH_RATE_LIMIT_RESET_MAX, 'Too many reset attempts. Try again in 15 minutes.');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A valid bcrypt-12 hash of a value nobody knows. Comparing against it when
// the account does not exist makes an unknown email cost the same wall-clock
// time as a known one - without it the 401 for an unknown email returned in
// ~5ms against ~300ms for a known one, which enumerated accounts by timing.
const DUMMY_HASH = '$2b$12$ZTYY5K5HLW9ioreuYOavCexQvP5mkWhSqT5ogWo2iB9V/N.YPBjHC';

const validateSignup = (body) => {
  const errors = [];
  const { name, email, password } = body || {};
  if (!name || typeof name !== 'string' || name.trim().length < 2) errors.push('name must be at least 2 characters');
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) errors.push('valid email is required');
  const weak = passwordProblem(password, email);
  if (weak) errors.push(weak);
  return errors;
};

const validateSignin = (body) => {
  const errors = [];
  const { email, password } = body || {};
  if (!email || typeof email !== 'string') errors.push('email is required');
  if (!password || typeof password !== 'string' || password.length < 1) errors.push('password is required');
  return errors;
};

const issueTokens = async (user, res, status = 200) => {
  const accessToken = signAccessToken(user);
  const { token: refreshToken, jti, expiresAt } = signRefreshToken(user);
  await storeRefreshToken(user.id, jti, expiresAt);
  // Plan 013: root path so the cookie is sent to both /auth/* (legacy)
  // and /api/v1/auth/* (canonical) mounts.
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return res.status(status).json({ success: true, user, accessToken });
};

router.post('/auth/signup', noStore, signupLimiter, async (req, res) => {
  try {
    const errors = validateSignup(req.body);
    if (errors.length) {
      return fail(res, { status: 400, code: 'VALIDATION_ERROR', message: errors.join('; '), requestId: req.id });
    }
    const { name, email, password } = req.body;
    if (await findUserByEmail(email)) {
      return fail(res, { status: 409, code: 'EMAIL_TAKEN', message: 'An account with this email already exists', requestId: req.id });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    try {
      const user = await createUser({ email, passwordHash, name });
      return await issueTokens(user, res, 201);
    } catch (err) {
      if (err.code === 'EMAIL_TAKEN') {
        return fail(res, { status: 409, code: 'EMAIL_TAKEN', message: 'An account with this email already exists', requestId: req.id });
      }
      throw err;
    }
  } catch (err) {
    req.log?.error({ err }, 'auth signup failed');
    return fail(res, { status: 500, code: 'INTERNAL', message: 'Signup failed', requestId: req.id });
  }
});

router.post('/auth/signin', noStore, signinLimiter, async (req, res) => {
  try {
    const errors = validateSignin(req.body);
    if (errors.length) {
      return fail(res, { status: 400, code: 'VALIDATION_ERROR', message: errors.join('; '), requestId: req.id });
    }
    const { email, password } = req.body;
    const ip = clientIp(req);

    // Brute-force lockout, keyed on (email, ip) so it cannot be used to lock a
    // victim out - and so it fires identically for unknown emails.
    const lock = await lockStatus(email, ip);
    if (lock.locked) {
      return fail(res, {
        status: 429,
        code: 'ACCOUNT_LOCKED',
        message: 'Too many failed sign-in attempts. Try again later.',
        requestId: req.id,
        retryAfterSec: Math.ceil(lock.retryAfterMs / 1000),
      });
    }

    const user = await findUserByEmail(email);
    // Always pay the bcrypt cost - for a missing account compare against a
    // throwaway hash so the response time cannot be used to tell whether the
    // email is registered.
    const ok = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);
    if (!user || !user.password_hash || !ok) {
      await recordFailure(email, ip);
      return fail(res, { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password', requestId: req.id });
    }
    await clearFailures(email, ip);
    await updateUser(user.id, { last_login: new Date().toISOString() });
    return await issueTokens(sanitize(user), res);
  } catch (err) {
    req.log?.error({ err }, 'auth signin failed');
    return fail(res, { status: 500, code: 'INTERNAL', message: 'Signin failed', requestId: req.id });
  }
});

router.post('/auth/refresh', noStore, refreshLimiter, async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return fail(res, { status: 401, code: 'NO_REFRESH_TOKEN', message: 'Refresh token required', requestId: req.id });
    }
    const payload = verifyRefreshToken(token);
    if (payload.type !== 'refresh' || !(await hasRefreshToken(payload.sub, payload.jti))) {
      return fail(res, { status: 401, code: 'INVALID_REFRESH', message: 'Invalid refresh token', requestId: req.id });
    }
    const user = await findUserById(payload.sub);
    if (!user) {
      return fail(res, { status: 401, code: 'UNAUTHENTICATED', message: 'User no longer exists', requestId: req.id });
    }
    await revokeRefreshToken(user.id, payload.jti);
    return await issueTokens(sanitize(user), res);
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return fail(res, { status: 401, code: 'INVALID_REFRESH', message: 'Invalid or expired refresh token', requestId: req.id });
    }
    req.log?.error({ err }, 'auth refresh failed');
    return fail(res, { status: 500, code: 'INTERNAL', message: 'Token refresh failed', requestId: req.id });
  }
});

router.post('/auth/signout', noStore, async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      try {
        const payload = verifyRefreshToken(token);
        await revokeRefreshToken(payload.sub, payload.jti);
      } catch { /* already invalid */ }
    }
    res.clearCookie('refreshToken', {
      path: '/',
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    return res.json({ success: true });
  } catch (err) {
    req.log?.error({ err }, 'auth signout failed');
    return fail(res, { status: 500, code: 'INTERNAL', message: 'Signout failed', requestId: req.id });
  }
});

router.get('/auth/me', noStore, requireAuth, (req, res) => {
  return res.json({ success: true, user: req.user });
});

router.delete('/auth/me', noStore, requireAuth, async (req, res) => {
  try {
    const result = await deleteUserAccount(req.user.id);
    if (!result.ok) {
      return fail(res, { status: 404, code: 'NOT_FOUND', message: 'User not found', requestId: req.id });
    }
    res.clearCookie('refreshToken', {
      path: '/',
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    return res.json({ success: true, deleted: true });
  } catch (err) {
    req.log?.error({ err }, 'auth delete-account failed');
    return fail(res, { status: 500, code: 'INTERNAL', message: 'Could not delete account', requestId: req.id });
  }
});

// ─── Google sign-in (identity services credential) ──────────────────────────
router.post('/auth/google', noStore, googleLimiter, async (req, res) => {
  try {
    const { credential } = req.body || {};
    if (!credential || typeof credential !== 'string' || credential.length > 8192) {
      return fail(res, { status: 400, code: 'VALIDATION_ERROR', message: 'credential is required', requestId: req.id });
    }
    if (!googleAuthEnabled()) {
      return fail(res, { status: 503, code: 'GOOGLE_NOT_CONFIGURED', message: 'Google sign-in is not configured on this server', requestId: req.id });
    }
    let profile;
    try {
      profile = await verifyGoogleCredential(credential);
    } catch (err) {
      if (err.code === 'GOOGLE_INVALID_TOKEN') {
        return fail(res, { status: 401, code: 'GOOGLE_INVALID_TOKEN', message: 'Invalid Google credential', requestId: req.id });
      }
      throw err;
    }
    const { user } = await upsertGoogleUser(profile);
    return await issueTokens(user, res, 200);
  } catch (err) {
    req.log?.error({ err }, 'auth google failed');
    return fail(res, { status: 500, code: 'INTERNAL', message: 'Google sign-in failed', requestId: req.id });
  }
});

// ─── Forgot / reset password (OTP via email) ─────────────────────────────────
// The response is IDENTICAL for known and unknown emails - always 200, always
// the same message. The old implementation answered a second request inside
// the resend cooldown with 429 RESEND_COOLDOWN, so "429 within 60s" against
// "200" told an attacker whether the account existed. The cooldown still
// protects the mailbox; it is simply no longer observable.
const RESET_MESSAGE = 'If that account exists, a reset code has been sent.';

router.post('/auth/forgot-password', noStore, forgotLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
      return fail(res, { status: 400, code: 'VALIDATION_ERROR', message: 'valid email is required', requestId: req.id });
    }
    const user = await findUserByEmail(email);

    // The account may or may not exist. Both cases do exactly the same work
    // - issue a code, hand it to the mailer, answer the same body - so the
    // response time cannot be used to enumerate accounts. Only the recipient
    // differs: an address with no account is delivered to our own sink, so
    // the SMTP round trip is paid identically and no third party is mailed.
    //
    // Issuing the code for an unknown address also keeps the reset flow
    // consistent: a later reset attempt for that address finds a code row
    // and takes the same "wrong code" path as a real account.
    let code;
    try {
      // With no SMTP the code is returned in the response instead of being
      // mailed, so there is no inbox to protect and the caller must always
      // get a usable code - re-issue freely.
      code = await issueOtp(user ? user.email : email, { force: otpShownInResponse() });
    } catch (err) {
      if (err.code === 'RESEND_COOLDOWN') {
        // Keep the still-valid earlier code, send nothing, answer identically.
        return res.json({ success: true, message: RESET_MESSAGE });
      }
      throw err;
    }
    const delivery = await sendOtpEmail({
      to: user ? user.email : sinkAddress(),
      name: user ? user.name : 'there',
      code,
    });
    return res.json({
      success: true,
      message: RESET_MESSAGE,
      // dev_otp is a development-only convenience and only ever appears for a
      // real account (production never returns it). The work behind the
      // response is identical either way - that is what closes the timing
      // oracle - so the dev-only field stays a dev-only difference.
      ...(user && delivery.dev_otp ? { dev_otp: delivery.dev_otp } : {}),
    });
  } catch (err) {
    req.log?.error({ err }, 'auth forgot-password failed');
    return fail(res, { status: 500, code: 'INTERNAL', message: 'Could not process request', requestId: req.id });
  }
});

router.post('/auth/reset-password', noStore, resetLimiter, async (req, res) => {
  try {
    const { email, otp, new_password } = req.body || {};
    const errors = [];
    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) errors.push('valid email is required');
    if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) errors.push('6-digit code is required');
    const weak = passwordProblem(new_password, email);
    if (weak) errors.push(weak);
    if (errors.length) {
      return fail(res, { status: 400, code: 'VALIDATION_ERROR', message: errors.join('; '), requestId: req.id });
    }
    const result = await verifyOtp(email, otp);
    if (!result.ok) {
      const messages = {
        missing: 'Invalid or expired reset code',
        expired: 'Reset code expired — request a new one',
        max_attempts: 'Too many attempts — request a new code',
        mismatch: `Incorrect code — ${result.attemptsLeft} attempts left`,
      };
      return fail(res, { status: 400, code: 'INVALID_OTP', message: messages[result.reason], requestId: req.id });
    }
    const user = await findUserByEmail(email);
    if (!user) {
      // The code verified but no account exists behind it (an address that
      // requested a code but never signed up). Answer with the same generic
      // failure AND pay the same cost as the success path, so a valid code
      // for a non-account does not stand out by being fast.
      await bcrypt.hash(new_password, 12);
      return fail(res, { status: 400, code: 'INVALID_OTP', message: 'Invalid or expired reset code', requestId: req.id });
    }
    const passwordHash = await bcrypt.hash(new_password, 12);
    await setPasswordHash(user.id, passwordHash);
    await revokeAllRefreshTokens(user.id); // password change kills every session
    return res.json({ success: true, message: 'Password updated — sign in with your new password.' });
  } catch (err) {
    req.log?.error({ err }, 'auth reset-password failed');
    return fail(res, { status: 500, code: 'INTERNAL', message: 'Could not process request', requestId: req.id });
  }
});

// ─── Favorites ────────────────────────────────────────────────────────────────
router.get('/auth/favorites', requireAuth, async (req, res) => {
  const ids = await getFavorites(req.user.id);
  const found = await getRestaurantsByCodes(ids);
  const byId = new Map(found.map((r) => [r.restaurant_id, r]));
  const items = ids.map((id) => byId.get(id)).filter(Boolean);
  return res.json({ success: true, favorites: ids, items });
});

router.post('/auth/favorites', requireAuth, async (req, res) => {
  const { restaurant_id } = req.body || {};
  if (!restaurant_id || typeof restaurant_id !== 'string') {
    return fail(res, { status: 400, code: 'VALIDATION_ERROR', message: 'restaurant_id is required', requestId: req.id });
  }
  if (!(await findRestaurantByCode(restaurant_id))) {
    return fail(res, { status: 404, code: 'NOT_FOUND', message: 'Unknown restaurant', requestId: req.id });
  }
  const result = await addFavorite(req.user.id, restaurant_id);
  if (!result.ok) {
    const status = result.error === 'FAVORITES_FULL' ? 409 : 404;
    return fail(res, { status, code: result.error, message: result.error === 'FAVORITES_FULL' ? 'Favorites list is full (max 50)' : 'User not found', requestId: req.id });
  }
  return res.status(result.added ? 201 : 200).json({ success: true, favorites: result.favorites, added: result.added });
});

router.delete('/auth/favorites/:restaurant_id', requireAuth, async (req, res) => {
  const result = await removeFavorite(req.user.id, req.params.restaurant_id);
  if (!result.ok) {
    return fail(res, { status: 404, code: 'NOT_FOUND', message: 'User not found', requestId: req.id });
  }
  return res.json({ success: true, favorites: result.favorites, removed: result.removed });
});

// ─── Saved places (memory-first wishlist) ───────────────────────────────────
router.get('/auth/saved-places', requireAuth, async (req, res) => {
  const places = await listSavedPlaces(req.user.id);
  return res.json({ success: true, places });
});

router.post('/auth/saved-places', requireAuth, async (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return fail(res, { status: 400, code: 'VALIDATION_ERROR', message: 'name is required', requestId: req.id });
  }
  try {
    const place = await createSavedPlace(req.user.id, { name });
    return res.status(201).json({ success: true, place });
  } catch (err) {
    if (err.code === 'SAVED_FULL') {
      return fail(res, { status: 409, code: 'SAVED_FULL', message: err.message, requestId: req.id });
    }
    if (err.code === 'USER_NOT_FOUND') {
      return fail(res, { status: 404, code: 'NOT_FOUND', message: 'User not found', requestId: req.id });
    }
    throw err;
  }
});

// Owner-only delete: another user's id (or a bogus id) is a 404, never a leak.
router.delete('/auth/saved-places/:id', requireAuth, async (req, res) => {
  const removed = await deleteSavedPlace(req.user.id, req.params.id);
  if (!removed) {
    return fail(res, { status: 404, code: 'NOT_FOUND', message: 'Saved place not found', requestId: req.id });
  }
  return res.status(200).json({ success: true, removed: true, id: req.params.id });
});

export { router as authRoutes };
