import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { createUser, findUserByEmail, findUserById, sanitize, storeRefreshToken, revokeRefreshToken, revokeAllRefreshTokens, hasRefreshToken, updateUser, setPasswordHash, getFavorites, addFavorite, removeFavorite, upsertGoogleUser, deleteUserAccount } from '../auth/store.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../auth/tokens.js';
import { requireAuth } from '../auth/middleware.js';
import { issueOtp, verifyOtp } from '../auth/otp.js';
import { sendOtpEmail } from '../services/email.service.js';
import { verifyGoogleCredential, googleAuthEnabled } from '../auth/google.js';
import { env } from '../env.js';
import { getRestaurantsByCodes, findRestaurantByCode } from '../db/catalogue.js';
import { createSavedPlace, listSavedPlaces, deleteSavedPlace } from '../saved_places/store.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in 15 minutes.' } },
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many reset requests. Try again in 15 minutes.' } },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateSignup = (body) => {
  const errors = [];
  const { name, email, password } = body || {};
  if (!name || typeof name !== 'string' || name.trim().length < 2) errors.push('name must be at least 2 characters');
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) errors.push('valid email is required');
  if (!password || typeof password !== 'string' || password.length < 8) errors.push('password must be at least 8 characters');
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

router.post('/auth/signup', authLimiter, async (req, res) => {
  try {
    const errors = validateSignup(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.join('; ') } });
    }
    const { name, email, password } = req.body;
    if (await findUserByEmail(email)) {
      return res.status(409).json({ success: false, error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists' } });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    try {
      const user = await createUser({ email, passwordHash, name });
      return await issueTokens(user, res, 201);
    } catch (err) {
      if (err.code === 'EMAIL_TAKEN') {
        return res.status(409).json({ success: false, error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists' } });
      }
      throw err;
    }
  } catch (err) {
    req.log?.error({ err }, 'auth signup failed');
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'Signup failed' } });
  }
});

router.post('/auth/signin', authLimiter, async (req, res) => {
  try {
    const errors = validateSignin(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.join('; ') } });
    }
    const { email, password } = req.body;
    const user = await findUserByEmail(email);
    if (!user || !user.password_hash) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }
    await updateUser(user.id, { last_login: new Date().toISOString() });
    return await issueTokens(sanitize(user), res);
  } catch (err) {
    req.log?.error({ err }, 'auth signin failed');
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'Signin failed' } });
  }
});

router.post('/auth/refresh', authLimiter, async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ success: false, error: { code: 'NO_REFRESH_TOKEN', message: 'Refresh token required' } });
    }
    const payload = verifyRefreshToken(token);
    if (payload.type !== 'refresh' || !(await hasRefreshToken(payload.sub, payload.jti))) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_REFRESH', message: 'Invalid refresh token' } });
    }
    const user = await findUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User no longer exists' } });
    }
    await revokeRefreshToken(user.id, payload.jti);
    return await issueTokens(sanitize(user), res);
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: { code: 'INVALID_REFRESH', message: 'Invalid or expired refresh token' } });
    }
    req.log?.error({ err }, 'auth refresh failed');
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'Token refresh failed' } });
  }
});

router.post('/auth/signout', async (req, res) => {
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
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'Signout failed' } });
  }
});

router.get('/auth/me', requireAuth, (req, res) => {
  return res.json({ success: true, user: req.user });
});

router.delete('/auth/me', requireAuth, async (req, res) => {
  try {
    const result = await deleteUserAccount(req.user.id);
    if (!result.ok) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
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
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'Could not delete account' } });
  }
});

// ─── Google sign-in (identity services credential) ──────────────────────────
router.post('/auth/google', authLimiter, async (req, res) => {
  try {
    const { credential } = req.body || {};
    if (!credential || typeof credential !== 'string' || credential.length > 8192) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'credential is required' } });
    }
    if (!googleAuthEnabled()) {
      return res.status(503).json({ success: false, error: { code: 'GOOGLE_NOT_CONFIGURED', message: 'Google sign-in is not configured on this server' } });
    }
    let profile;
    try {
      profile = await verifyGoogleCredential(credential);
    } catch (err) {
      if (err.code === 'GOOGLE_INVALID_TOKEN') {
        return res.status(401).json({ success: false, error: { code: 'GOOGLE_INVALID_TOKEN', message: 'Invalid Google credential' } });
      }
      throw err;
    }
    const { user } = await upsertGoogleUser(profile);
    return await issueTokens(user, res, 200);
  } catch (err) {
    req.log?.error({ err }, 'auth google failed');
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'Google sign-in failed' } });
  }
});

// ─── Forgot / reset password (OTP via email) ─────────────────────────────────
// Always returns 200 for unknown emails (no account enumeration).
router.post('/auth/forgot-password', resetLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'valid email is required' } });
    }
    const user = await findUserByEmail(email);
    if (!user) {
      return res.json({ success: true, message: 'If that account exists, a reset code has been sent.' });
    }
    let code;
    try {
      code = await issueOtp(user.email);
    } catch (err) {
      if (err.code === 'RESEND_COOLDOWN') {
        return res.status(429).json({ success: false, error: { code: 'RESEND_COOLDOWN', message: err.message, retry_after_ms: err.retryAfterMs } });
      }
      throw err;
    }
    const delivery = await sendOtpEmail({ to: user.email, name: user.name, code });
    return res.json({
      success: true,
      message: 'If that account exists, a reset code has been sent.',
      ...(delivery.dev_otp ? { dev_otp: delivery.dev_otp } : {}),
    });
  } catch (err) {
    req.log?.error({ err }, 'auth forgot-password failed');
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'Could not process request' } });
  }
});

router.post('/auth/reset-password', resetLimiter, async (req, res) => {
  try {
    const { email, otp, new_password } = req.body || {};
    const errors = [];
    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) errors.push('valid email is required');
    if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) errors.push('6-digit code is required');
    if (!new_password || typeof new_password !== 'string' || new_password.length < 8) errors.push('new password must be at least 8 characters');
    if (errors.length) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.join('; ') } });
    }
    const result = await verifyOtp(email, otp);
    if (!result.ok) {
      const messages = {
        missing: 'Invalid or expired reset code',
        expired: 'Reset code expired — request a new one',
        max_attempts: 'Too many attempts — request a new code',
        mismatch: `Incorrect code — ${result.attemptsLeft} attempts left`,
      };
      return res.status(400).json({ success: false, error: { code: 'INVALID_OTP', message: messages[result.reason] } });
    }
    const user = await findUserByEmail(email);
    if (!user) {
      // OTP verified but user gone — treat as generic failure, do not leak state
      return res.status(400).json({ success: false, error: { code: 'INVALID_OTP', message: 'Invalid or expired reset code' } });
    }
    const passwordHash = await bcrypt.hash(new_password, 12);
    await setPasswordHash(user.id, passwordHash);
    await revokeAllRefreshTokens(user.id); // password change kills every session
    return res.json({ success: true, message: 'Password updated — sign in with your new password.' });
  } catch (err) {
    req.log?.error({ err }, 'auth reset-password failed');
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'Could not process request' } });
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
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'restaurant_id is required' } });
  }
  if (!(await findRestaurantByCode(restaurant_id))) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Unknown restaurant' } });
  }
  const result = await addFavorite(req.user.id, restaurant_id);
  if (!result.ok) {
    return res.status(result.error === 'FAVORITES_FULL' ? 409 : 404).json({ success: false, error: { code: result.error, message: result.error === 'FAVORITES_FULL' ? 'Favorites list is full (max 50)' : 'User not found' } });
  }
  return res.status(result.added ? 201 : 200).json({ success: true, favorites: result.favorites, added: result.added });
});

router.delete('/auth/favorites/:restaurant_id', requireAuth, async (req, res) => {
  const result = await removeFavorite(req.user.id, req.params.restaurant_id);
  if (!result.ok) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
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
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name is required' } });
  }
  try {
    const place = await createSavedPlace(req.user.id, { name });
    return res.status(201).json({ success: true, place });
  } catch (err) {
    if (err.code === 'SAVED_FULL') {
      return res.status(409).json({ success: false, error: { code: 'SAVED_FULL', message: err.message } });
    }
    if (err.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    throw err;
  }
});

// Owner-only delete: another user's id (or a bogus id) is a 404, never a leak.
router.delete('/auth/saved-places/:id', requireAuth, async (req, res) => {
  const removed = await deleteSavedPlace(req.user.id, req.params.id);
  if (!removed) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Saved place not found' } });
  }
  return res.status(200).json({ success: true, removed: true, id: req.params.id });
});

export { router as authRoutes };
