import { verifyAccessToken } from './tokens.js';
import { findUserById, sanitize } from './store.js';
import { fail } from '../lib/respond.js';

// Every rejection here uses the canonical failure envelope (error.code,
// error.message, error.requestId) so a 401/403 can be joined to the request
// log line the same way a route error can. Hand-rolled bodies used to omit
// requestId, which made auth failures the only errors support could not trace.

export const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return fail(res, { status: 401, code: 'UNAUTHENTICATED', message: 'Authentication required', requestId: req.id });
  }

  // Only token verification belongs in this try. A database failure is not an
  // authentication failure: reporting it as 401 makes the SPA treat a Neon
  // blip as an expired session and sign every user out.
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    return fail(res, { status: 401, code, message: 'Invalid or expired token', requestId: req.id });
  }

  let user;
  try {
    user = await findUserById(payload.sub);
  } catch (err) {
    return next(err);
  }
  if (!user) {
    return fail(res, { status: 401, code: 'UNAUTHENTICATED', message: 'User no longer exists', requestId: req.id });
  }
  req.user = sanitize(user);
  next();
};

export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return fail(res, { status: 401, code: 'UNAUTHENTICATED', message: 'Authentication required', requestId: req.id });
  }
  if (req.user.role !== 'admin') {
    return fail(res, { status: 403, code: 'FORBIDDEN', message: 'Admin access required', requestId: req.id });
  }
  next();
};
