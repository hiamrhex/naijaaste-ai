import { verifyAccessToken } from './tokens.js';
import { findUserById, sanitize } from './store.js';

export const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
  }
  try {
    const payload = verifyAccessToken(token);
    const user = findUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User no longer exists' } });
    }
    req.user = sanitize(user);
    next();
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    return res.status(401).json({ success: false, error: { code, message: 'Invalid or expired token' } });
  }
};
