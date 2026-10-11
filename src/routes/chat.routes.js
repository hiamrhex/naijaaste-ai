import { Router } from 'express';
import { processChat, getSession, clearSession } from '../services/chat.service.js';
import { badRequest, notFound } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { chatBodySchema } from '../schemas/index.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ─── Start or Continue Chat ───────────────────────────────────────────────────
router.post('/chat', validate(chatBodySchema), async (req, res, next) => {
  try {
    const { message, session_id } = req.body;

    // Use provided session_id or generate new one (message already trimmed by schema)
    const sessionId = session_id || uuidv4();
    const result = await processChat(sessionId, message);
    if (!result.success) {
      // processChat returns success:false only for the >500-char guard
      return next(badRequest(result.error));
    }

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Get Session State ────────────────────────────────────────────────────────
router.get('/chat/:sessionId', (req, res, next) => {
  try {
    const session = getSession(req.params.sessionId);
    if (!session) {
      return next(notFound('SESSION_NOT_FOUND', 'Session not found'));
    }
    return res.status(200).json({ success: true, session });
  } catch (err) {
    next(err);
  }
});

// ─── Clear Session ────────────────────────────────────────────────────────────
router.delete('/chat/:sessionId', async (req, res, next) => {
  try {
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
