import { Router } from 'express';
import { runAgent } from '../agent/agent.js';
import { requireAuth } from '../auth/middleware.js';
import { getSession, saveSession } from '../services/chat.service.js';
import { deterministicAgentReply, picksFromAnswer, buildFallbackPersona } from '../services/fallback.service.js';
import { getDeterministicRecommendations } from '../services/recommend.service.js';
import { ApiError } from '../lib/errors.js';
import { fail } from '../lib/respond.js';
import { validate } from '../middleware/validate.js';
import { chatBodySchema } from '../schemas/index.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// A model failure must not end the conversation: when Gemini times out, is
// unavailable or the circuit is open, we answer with deterministic catalogue
// picks instead of a dead end. Only when even that fails do we return an
// error — and then it is always JSON with the request id.
const isModelFailure = (err) =>
  err?.code === 'LLM_TIMEOUT' ||
  err?.code === 'LLM_UNAVAILABLE' ||
  err?.code === 'CIRCUIT_OPEN' ||
  (typeof err?.status === 'number' && err.status >= 400);

router.post('/agent', requireAuth, validate(chatBodySchema), async (req, res) => {
  try {
    const { message, session_id } = req.body || {};

    const sessionId = session_id || uuidv4();
    const existing = await getSession(sessionId);
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
    let text;
    let trace;
    let fallback = null;

    try {
      ({ text, trace } = await runAgent(session, message));
    } catch (err) {
      if (!isModelFailure(err)) throw err;
      // Deterministic fallback: real catalogue rows, no model involved.
      fallback = await deterministicAgentReply(session, message, err?.code || 'LLM_UNAVAILABLE');
      if (!fallback) {
        // No fallback available → typed JSON error with the request id.
        const timedOut = err?.code === 'LLM_TIMEOUT';
        return res.status(timedOut ? 504 : 503).json({
          success: false,
          error: {
            code: timedOut ? 'AI_TIMEOUT' : 'AI_UNAVAILABLE',
            message: timedOut
              ? 'The AI service took too long to respond. Please try again.'
              : 'The AI service is unavailable right now. Please try again in a moment.',
          },
          requestId: req.id,
        });
      }
      text = fallback.text;
      trace = [{ step: 0, tool: 'deterministic_fallback', ok: true, final: true, ms: Date.now() - startTime }];
    }

    session.conversation_history.push(
      { role: 'user', content: message.trim(), timestamp: new Date().toISOString() },
      { role: 'assistant', content: text, timestamp: new Date().toISOString() }
    );
    session.conversation_history = session.conversation_history.slice(-20);
    session.last_active = new Date().toISOString();
    if (fallback) {
      session.stage = 'recommend';
      session.recommendations = {
        success: true,
        fallback: true,
        recommendations: fallback.picks,
      };
    }

    // The agent often answers in prose without calling get_recommendations,
    // which left the results panel empty and the food as markdown. Match the
    // spots it named against the catalogue so the cards always appear, and
    // fall back to a deterministic ranking if it named none.
    if (!session.recommendations) {
      try {
        const persona = buildFallbackPersona(session, message);
        const named = await picksFromAnswer(text, persona);
        const picks = named.length
          ? named
          : (persona.city_known
            ? (await getDeterministicRecommendations(persona, 'AGENT_NO_PICKS')).recommendations || []
            : []);
        if (picks.length) {
          session.stage = 'recommend';
          session.recommendations = {
            success: true,
            fallback: true,
            recommendations: picks.map((p, i) => ({ ...p, rank: i + 1 })),
          };
        }
      } catch (err) {
        req.log?.warn({ err: err?.message }, 'could not build results for the agent turn');
      }
    }
    await saveSession(session);

    return res.status(200).json({
      success: true,
      session_id: sessionId,
      stage: session.stage,
      message: text,
      extracted_persona: session.extracted_persona,
      recommendations: session.recommendations || null,
      trace: trace.map(({ step, tool, ok, error, ms, final }) => ({ step, tool, ok, error, ms, final })),
      meta: {
        latency_ms: Date.now() - startTime,
        steps: trace.length,
        agent: true,
        fallback: !!fallback,
        fallback_reason: fallback?.reason || null,
      },
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
