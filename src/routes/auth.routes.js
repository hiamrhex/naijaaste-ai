import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { createUser, findUserByEmail, findUserById, sanitize, storeRefreshToken, revokeRefreshToken, revokeAllRefreshTokens, hasRefreshToken, updateUser, setPasswordHash, getFavorites, addFavorite, removeFavorite } from '../auth/store.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../auth/tokens.js';
import { requireAuth } from '../auth/middleware.js';
import { issueOtp, verifyOtp } from '../auth/otp.js';
import { sendOtpEmail } from '../services/email.service.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOGUE = JSON.parse(readFileSync(join(__dirname, '../data/restaurants.json'), 'utf-8'));
const catalogueById = new Map(CATALOGUE.map((r) => [r.restaurant_id, r]));

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

const issueTokens = (user, res, status = 200) => {
  const accessToken = signAccessToken(user);
  const { token: refreshToken, jti, expiresAt } = signRefreshToken(user);
  storeRefreshToken(user.id, jti, expiresAt);
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/auth',
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
    if (findUserByEmail(email)) {
      return res.status(409).json({ success: false, error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists' } });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = createUser({ email, passwordHash, name });
    return issueTokens(user, res, 201);
  } catch (err) {
    console.error('[auth] signup error:', err.message);
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
    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }
    updateUser(user.id, { last_login: new Date().toISOString() });
    return issueTokens(sanitize(user), res);
  } catch (err) {
    console.error('[auth] signin error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'Signin failed' } });
  }
});

router.post('/auth/refresh', authLimiter, (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ success: false, error: { code: 'NO_REFRESH_TOKEN', message: 'Refresh token required' } });
    }
    const payload = verifyRefreshToken(token);
    if (payload.type !== 'refresh' || !hasRefreshToken(payload.sub, payload.jti)) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_REFRESH', message: 'Invalid refresh token' } });
    }
    const user = findUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User no longer exists' } });
    }
    revokeRefreshToken(user.id, payload.jti);
    return issueTokens(sanitize(user), res);
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: { code: 'INVALID_REFRESH', message: 'Invalid or expired refresh token' } });
    }
    console.error('[auth] refresh error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'Token refresh failed' } });
  }
});

router.post('/auth/signout', (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      try {
        const payload = verifyRefreshToken(token);
        revokeRefreshToken(payload.sub, payload.jti);
      } catch { /* already invalid */ }
    }
    res.clearCookie('refreshToken', { path: '/auth' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[auth] signout error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'Signout failed' } });
  }
});

router.get('/auth/me', requireAuth, (req, res) => {
  return res.json({ success: true, user: req.user });
});

// ─── Forgot / reset password (OTP via email) ─────────────────────────────────
// Always returns 200 for unknown emails (no account enumeration).
router.post('/auth/forgot-password', resetLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'valid email is required' } });
    }
    const user = findUserByEmail(email);
    if (!user) {
      return res.json({ success: true, message: 'If that account exists, a reset code has been sent.' });
    }
    let code;
    try {
      code = issueOtp(user.email);
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
    console.error('[auth] forgot-password error:', err.message);
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
    const result = verifyOtp(email, otp);
    if (!result.ok) {
      const messages = {
        missing: 'Invalid or expired reset code',
        expired: 'Reset code expired — request a new one',
        max_attempts: 'Too many attempts — request a new code',
        mismatch: `Incorrect code — ${result.attemptsLeft} attempts left`,
      };
      return res.status(400).json({ success: false, error: { code: 'INVALID_OTP', message: messages[result.reason] } });
    }
    const user = findUserByEmail(email);
    if (!user) {
      // OTP verified but user gone — treat as generic failure, do not leak state
      return res.status(400).json({ success: false, error: { code: 'INVALID_OTP', message: 'Invalid or expired reset code' } });
    }
    const passwordHash = await bcrypt.hash(new_password, 12);
    setPasswordHash(user.id, passwordHash);
    revokeAllRefreshTokens(user.id); // password change kills every session
    return res.json({ success: true, message: 'Password updated — sign in with your new password.' });
  } catch (err) {
    console.error('[auth] reset-password error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'Could not process request' } });
  }
});

// ─── Favorites ────────────────────────────────────────────────────────────────
router.get('/auth/favorites', requireAuth, (req, res) => {
  const ids = getFavorites(req.user.id);
  const items = ids.map((id) => catalogueById.get(id)).filter(Boolean);
  return res.json({ success: true, favorites: ids, items });
});

router.post('/auth/favorites', requireAuth, (req, res) => {
  const { restaurant_id } = req.body || {};
  if (!restaurant_id || typeof restaurant_id !== 'string') {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'restaurant_id is required' } });
  }
  if (!catalogueById.has(restaurant_id)) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Unknown restaurant' } });
  }
  const result = addFavorite(req.user.id, restaurant_id);
  if (!result.ok) {
    return res.status(result.error === 'FAVORITES_FULL' ? 409 : 404).json({ success: false, error: { code: result.error, message: result.error === 'FAVORITES_FULL' ? 'Favorites list is full (max 50)' : 'User not found' } });
  }
  return res.status(result.added ? 201 : 200).json({ success: true, favorites: result.favorites, added: result.added });
});

router.delete('/auth/favorites/:restaurant_id', requireAuth, (req, res) => {
  const result = removeFavorite(req.user.id, req.params.restaurant_id);
  if (!result.ok) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
  }
  return res.json({ success: true, favorites: result.favorites, removed: result.removed });
});

export { router as authRoutes };
