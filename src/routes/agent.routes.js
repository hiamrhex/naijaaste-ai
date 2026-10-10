import { Router } from 'express';
import { runAgent } from '../agent/agent.js';
import { requireAuth } from '../auth/middleware.js';
import { getSession, saveSession } from '../services/chat.service.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.post('/agent', requireAuth, async (req, res) => {
  try {
    const { message, session_id } = req.body || {};
    if (!message || typeof message !== 'string' || message.trim().length < 1) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'message is required' } });
    }
    if (message.length > 500) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Message too long. Please keep under 500 characters.' } });
    }

    const sessionId = session_id || uuidv4();
    const existing = getSession(sessionId);
    const session = existing || {
      session_id: sessionId,
      conversation_history: [],
      extracted_persona: { preference_history: [] },
      stage: 'gather',
      recommendations: null,
      created_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
    };

    const startTime = Date.now();
    const { text, trace } = await runAgent(session, message.trim());

    session.conversation_history.push(
      { role: 'user', content: message.trim(), timestamp: new Date().toISOString() },
      { role: 'assistant', content: text, timestamp: new Date().toISOString() }
    );
    session.conversation_history = session.conversation_history.slice(-20);
    session.last_active = new Date().toISOString();
    saveSession(session);

    return res.status(200).json({
      success: true,
      session_id: sessionId,
      stage: session.stage,
      message: text,
      extracted_persona: session.extracted_persona,
      recommendations: session.recommendations || null,
      trace: trace.map(({ step, tool, ok, error, ms, final }) => ({ step, tool, ok, error, ms, final })),
      meta: { latency_ms: Date.now() - startTime, steps: trace.length, agent: true },
    });
  } catch (err) {
    console.error('[agent] Error:', err.message);
    return res.status(500).json({
      success: false,
      error: { code: err.status === 400 ? 'UPSTREAM_AUTH' : 'AGENT_FAILED', message: 'Agent run failed', detail: err.message },
    });
  }
});

export { router as agentRoutes };
