import { Router } from 'express';
import { processChat, getSession, clearSession, sessionAccess } from '../services/chat.service.js';
import { verifyAccessToken } from '../auth/tokens.js';
import { badRequest, notFound } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { chatBodySchema } from '../schemas/index.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const assertUuidParam = (req, _res, next) => {
  if (!UUID_RE.test(req.params.sessionId || '')) {
    return next(badRequest('session_id must be a valid UUID'));
  }
  next();
};

// ─── Session identity ─────────────────────────────────────────────────────────
// A chat session has exactly one owner:
//   - a signed-in user   → the user's access token
//   - an anonymous caller → the session capability handed out at creation
//
// Both are presented the same way: `Authorization: Bearer <token>`. We try the
// access token first; if it is not a valid JWT we treat it as the session
// capability. Nothing here reveals whether a session id exists: a caller
// without ownership gets 404, exactly like a session that never existed.
const bearerToken = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
};

// Resolve the caller without failing the request: the same token may be a
// user token, a session capability, or neither.
const resolveCaller = (req) => {
  const token = bearerToken(req);
  if (!token) return { userId: null, capability: null };
  try {
    const payload = verifyAccessToken(token);
    if (payload?.sub) return { userId: payload.sub, capability: null };
  } catch {
    // Not a JWT → treat it as a session capability.
  }
  return { userId: null, capability: token };
};

// ─── Start or Continue Chat ───────────────────────────────────────────────────
router.post('/chat', validate(chatBodySchema), async (req, res, next) => {
  try {
    const { message, session_id } = req.body;
    const caller = resolveCaller(req);

    // Use provided session_id or generate new one (message already trimmed by schema)
    const sessionId = session_id || uuidv4();

    // Continuing someone else's session is refused before any work happens.
    if (session_id) {
      const access = await sessionAccess(sessionId, caller);
      if (!access.owned) {
        return next(notFound('SESSION_NOT_FOUND', 'Session not found'));
      }
    }

    const result = await processChat(sessionId, message, caller);
    if (!result.success) {
      // processChat returns success:false only for the >500-char guard
      return next(badRequest(result.error));
    }

    return res.status(200).json(result);
  } catch (err) {
    if (err?.code === 'SESSION_FORBIDDEN') {
      return next(notFound('SESSION_NOT_FOUND', 'Session not found'));
    }
    next(err);
  }
});

// ─── Get Session State ────────────────────────────────────────────────────────
router.get('/chat/:sessionId', assertUuidParam, async (req, res, next) => {
  try {
    const access = await sessionAccess(req.params.sessionId, resolveCaller(req));
    if (!access.owned) {
      // 404, never 403/401 — a different answer would confirm the session
      // exists (the defect the independent review found).
      return next(notFound('SESSION_NOT_FOUND', 'Session not found'));
    }
    const session = await getSession(req.params.sessionId);
    if (!session) {
      return next(notFound('SESSION_NOT_FOUND', 'Session not found'));
    }
    return res.status(200).json({ success: true, session });
  } catch (err) {
    next(err);
  }
});

// ─── Clear Session ────────────────────────────────────────────────────────────
router.delete('/chat/:sessionId', assertUuidParam, async (req, res, next) => {
  try {
    const access = await sessionAccess(req.params.sessionId, resolveCaller(req));
    if (!access.owned) {
      return next(notFound('SESSION_NOT_FOUND', 'Session not found'));
    }
    const result = await clearSession(req.params.sessionId);
    if (!result.success) {
      return next(notFound('SESSION_NOT_FOUND', 'Session not found'));
    }
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export { router as chatRoutes };
