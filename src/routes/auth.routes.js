import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { createUser, findUserByEmail, findUserById, sanitize, storeRefreshToken, revokeRefreshToken, hasRefreshToken, updateUser } from '../auth/store.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../auth/tokens.js';
import { requireAuth } from '../auth/middleware.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in 15 minutes.' } },
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

export { router as authRoutes };
