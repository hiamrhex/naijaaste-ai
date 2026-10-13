import { Router } from 'express';
import { runAgent } from '../agent/agent.js';
import { requireAuth } from '../auth/middleware.js';
import { getSession, saveSession } from '../services/chat.service.js';
import { ApiError } from '../lib/errors.js';
import { fail } from '../lib/respond.js';
import { validate } from '../middleware/validate.js';
import { chatBodySchema } from '../schemas/index.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.post('/agent', requireAuth, validate(chatBodySchema), async (req, res) => {
  try {
    const { message, session_id } = req.body || {};

    const sessionId = session_id || uuidv4();
    const existing = getSession(sessionId);
    if (existing?.user_id && existing.user_id !== req.user.id) {
      return fail(res, {
        status: 403, code: 'FORBIDDEN',
        message: 'Session belongs to another user',
        requestId: req.id,
      });
    }
    const session = existing || {
      session_id: sessionId,
      user_id: req.user.id,
      conversation_history: [],
      extracted_persona: { preference_history: [] },
      stage: 'gather',
      recommendations: null,
      created_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
    };
    // Claim-on-first-agent-use: anonymous sessions gain an owner the first
    // time an authenticated caller uses them via /agent.
    if (!session.user_id) session.user_id = req.user.id;

    const startTime = Date.now();
    const { text, trace } = await runAgent(session, message);

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
    if (err instanceof ApiError) return res.status(err.status).json({
      success: false, error: { code: err.code, message: err.message }, requestId: req.id,
    });
    if (typeof err?.status === 'number') {
      // GoogleGenAI ApiError — map to the contract, never leak the SDK message
      return res.status(502).json({
        success: false,
        error: {
          code: err.status === 400 || err.status === 401 ? 'UPSTREAM_AUTH' : 'UPSTREAM_FAILURE',
          message: err.status === 400 || err.status === 401
            ? 'Upstream LLM authentication failed'
            : 'Upstream LLM request failed',
        },
        requestId: req.id,
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'AGENT_FAILED', message: 'Agent run failed' },
      requestId: req.id,
    });
  }
});

export { router as agentRoutes };
