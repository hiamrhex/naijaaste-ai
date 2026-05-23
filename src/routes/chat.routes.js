import { Router } from 'express';
import { processChat, getSession, clearSession } from '../services/chat.service.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ─── Start or Continue Chat ───────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  try {
    const { message, session_id } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length < 1) {
      return res.status(400).json({
        success: false,
        error: 'message is required'
      });
    }

    // Use provided session_id or generate new one
    const sessionId = session_id || uuidv4();
    const result = await processChat(sessionId, message.trim());

    return res.status(200).json(result);

  } catch (error) {
    console.error('[chat] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Chat processing failed',
      detail: error.message
    });
  }
});

// ─── Get Session State ────────────────────────────────────────────────────────
router.get('/chat/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }
  return res.status(200).json({ success: true, session });
});

// ─── Clear Session ────────────────────────────────────────────────────────────
router.delete('/chat/:sessionId', (req, res) => {
  const result = clearSession(req.params.sessionId);
  return res.status(200).json(result);
});

export { router as chatRoutes };