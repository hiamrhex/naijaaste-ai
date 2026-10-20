import { buildChatSystemPrompt, buildChatUserPrompt } from '../prompts/chat.prompt.js';
import { callLLMJson } from './llm.service.js';
import { getRecommendations } from './recommend.service.js';
import { getPool } from '../db/pool.js';
import { logger } from '../lib/logger.js';
import { AiTimeoutError, AiUnavailableError } from '../lib/errors.js';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// Circuit open or upstream unreachable → a known, clean 503, not a 500.
// Any provider-shaped failure (invalid key, throttling, 5xx) is an AI outage
// from the client's point of view. They must never surface as a bare 500.
const isUpstreamFailure = (err) =>
  err?.code === 'CIRCUIT_OPEN' ||
  (typeof err?.status === 'number' && err.status >= 400);

// Session expiry — 24 hours
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// ─── Session ownership ────────────────────────────────────────────────────────
// Every session has exactly one owner:
//   - a signed-in user  → sessions.user_id
//   - an anonymous user → sessions.capability_hash (SHA-256 of a bearer
//     capability handed out once, at creation, and never stored in clear)
//
// GET/DELETE /chat/:id accept the owning user's access token OR the
// session's capability. Anyone else gets 404 — never 403/401, because
// "forbidden" would confirm that a session id exists.
const hashCapability = (capability) =>
  createHash('sha256').update(String(capability)).digest('hex');

export const newCapability = () => randomBytes(32).toString('base64url');

const capabilityMatches = (expectedHash, presented) => {
  if (!expectedHash || !presented) return false;
  const a = Buffer.from(expectedHash);
  const b = Buffer.from(hashCapability(presented));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

// ─── Persistent Session Store (Postgres) ──────────────────────────────────────
const rowToSession = (row) => {
  if (!row) return null;
  if (Date.now() - new Date(row.updated_at).getTime() > SESSION_TTL_MS) return null;
  const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  return data;
};

const loadSession = async (sessionId) => {
  const pool = await getPool();
  const { rows } = await pool.query('SELECT data, updated_at FROM sessions WHERE id = $1', [sessionId]);
  const session = rowToSession(rows[0]);
  if (rows[0] && !session) {
    await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]).catch(() => {});
  }
  return session;
};

// Ownership metadata, read without the session body.
const loadSessionOwnership = async (sessionId) => {
  const pool = await getPool();
  const { rows } = await pool.query(
    'SELECT user_id, capability_hash, updated_at FROM sessions WHERE id = $1',
    [sessionId]
  );
  const row = rows[0];
  if (!row) return null;
  if (Date.now() - new Date(row.updated_at).getTime() > SESSION_TTL_MS) return null;
  return { user_id: row.user_id || null, capability_hash: row.capability_hash || null };
};

const blankSession = (sessionId) => ({
  session_id: sessionId,
  user_id: null,
  conversation_history: [],
  extracted_persona: { preference_history: [] },
  stage: 'gather',
  recommendations: null,
  created_at: new Date().toISOString(),
  last_active: new Date().toISOString(),
});

// Persist one session; resolves true/false (keeps the honest flag).
const persistSession = async (session, capabilityHash) => {
  try {
    const pool = await getPool();
    await pool.query(
      `INSERT INTO sessions (id, user_id, data, capability_hash, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         data = EXCLUDED.data,
         capability_hash = COALESCE(EXCLUDED.capability_hash, sessions.capability_hash),
         updated_at = now()`,
      [session.session_id, session.user_id || null, JSON.stringify(session), capabilityHash || null]
    );
    return true;
  } catch (err) {
    logger.error({ err }, 'session persist failed');
    return false;
  }
};


// ─── Helpers ──────────────────────────────────────────────────────────────────
const REQUIRED_FIELDS = ['city', 'budget_level', 'spice_tolerance', 'social_context'];

const isPersonaComplete = (persona) =>
  REQUIRED_FIELDS.every(f => persona[f]);

const mergePersona = (existing, extracted) => ({
  ...existing,
  ...Object.fromEntries(
    Object.entries(extracted).filter(([_, v]) => v !== null && v !== undefined)
  )
});

// ─── Main Chat Processor ──────────────────────────────────────────────────────
// `owner` describes who the session belongs to:
//   { userId }            → an authenticated user (sessions.user_id)
//   { capability }        → an anonymous caller holding a bearer capability
// The capability is only ever returned once, at creation.
export const processChat = async (sessionId, userMessage, owner = {}) => {
  const startTime = Date.now();

  // Input length guard — prevents context bloat
  if (userMessage.length > 500) {
    return {
      success: false,
      error: 'Message too long. Please keep under 500 characters.',
      session_id: sessionId
    };
  }

  // Get or create session
  const existingOwnership = await loadSessionOwnership(sessionId);
  let session = await loadSession(sessionId);
  if (!session) session = blankSession(sessionId);

  // Ownership: a session belongs to exactly one party, and continuing it
  // requires proof of that. Anonymous sessions are proven by their bearer
  // capability; signed-in sessions by the user id.
  let capability = null;
  if (!existingOwnership) {
    // First use: claim the session for its creator.
    if (owner.userId) {
      session.user_id = owner.userId;
    } else {
      capability = newCapability();
      session.user_id = null;
    }
  } else if (existingOwnership.user_id) {
    if (!owner.userId || existingOwnership.user_id !== owner.userId) {
      const err = new Error('Session belongs to another user');
      err.code = 'SESSION_FORBIDDEN';
      throw err;
    }
  } else if (!capabilityMatches(existingOwnership.capability_hash, owner.capability)) {
    // Anonymous session: only the holder of the capability may continue it.
    const err = new Error('Session belongs to another caller');
    err.code = 'SESSION_FORBIDDEN';
    throw err;
  }

  session.last_active = new Date().toISOString();

  // Add user message to history
  session.conversation_history.push({
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString()
  });

  // Build and call LLM
  const combinedPrompt = `${buildChatSystemPrompt()}\n\n${buildChatUserPrompt(
    userMessage,
    session.conversation_history,
    session.extracted_persona
  )}`;

  let llmResponse;
  try {
    llmResponse = await callLLMJson(combinedPrompt, 1500);
  } catch (err) {
    // Contract for this endpoint: a typed JSON error with the request id.
    //   LLM_TIMEOUT  → 504 AI_TIMEOUT
    //   provider/circuit → 503 AI_UNAVAILABLE
    // The conversational path (/agent) is the one that degrades to a
    // deterministic catalogue answer; /chat keeps the machine-readable
    // contract so API consumers can tell "no answer" from "answer".
    if (err?.code === 'LLM_TIMEOUT') {
      logger.warn({ err: err.code, timeout_ms: err.timeoutMs }, 'chat turn: LLM budget exhausted');
      throw new AiTimeoutError();
    }
    if (isUpstreamFailure(err)) {
      logger.warn({ err: err.code || err.message }, 'chat turn: upstream LLM unavailable');
      throw new AiUnavailableError();
    }
    throw err;
  }

  // Merge extracted persona
  if (llmResponse.extracted_persona) {
    session.extracted_persona = mergePersona(
      session.extracted_persona,
      llmResponse.extracted_persona
    );
  }

  // Update stage
  session.stage = llmResponse.stage || session.stage;

  // Add assistant response — keep last 20 messages
  session.conversation_history.push({
    role: 'assistant',
    content: llmResponse.message,
    timestamp: new Date().toISOString()
  });
  session.conversation_history = session.conversation_history.slice(-20);

  // Trigger recommendation if ready
  let recommendations = null;
  if (llmResponse.ready_to_recommend && !session.recommendations) {
    const fullPersona = {
      persona_id: uuidv4(),
      full_name: session.extracted_persona.full_name || 'Anonymous',
      age: session.extracted_persona.age || 28,
      city: session.extracted_persona.city || 'Lagos',
      occupation: session.extracted_persona.occupation || 'Not specified',
      income_level: session.extracted_persona.income_level || 'middle',
      budget_level: session.extracted_persona.budget_level || 'mid_range',
      spice_tolerance: session.extracted_persona.spice_tolerance || 'medium',
      ambience_preference: session.extracted_persona.ambience_preference || 'casual_dining',
      value_sensitivity: session.extracted_persona.value_sensitivity || 'value_seeker',
      social_context: session.extracted_persona.social_context || 'solo',
      preferred_cuisines: session.extracted_persona.preferred_cuisines || ['Street Food'],
      dietary_flags: session.extracted_persona.dietary_flags || ['none'],
      preference_history: session.extracted_persona.preference_history || [],
      created_at: new Date().toISOString()
    };

    try {
      recommendations = await getRecommendations(fullPersona);
      session.recommendations = recommendations;
    } catch (err) {
      logger.error({ err }, 'recommendation failed in chat turn');
    }
  }

  // Persist — await the write so the flag is honest
  const persisted = await persistSession(session, capability ? hashCapability(capability) : null);

  return {
    success: true,
    session_id: sessionId,
    stage: session.stage,
    message: llmResponse.message,
    recommendations: recommendations || session.recommendations || null,
    extracted_persona: session.extracted_persona,
    missing_fields: llmResponse.missing_fields || [],
    // The capability is returned exactly once, at creation. Anonymous
    // callers must present it as a bearer token to read or delete the
    // session afterwards.
    ...(capability ? { session_capability: capability } : {}),
    meta: {
      turn_count: session.conversation_history.filter(m => m.role === 'user').length,
      persona_complete: isPersonaComplete(session.extracted_persona),
      session_persisted: persisted,
      last_active: session.last_active,
      latency_ms: Date.now() - startTime
    }
  };
};

export const getSession = async (sessionId) => loadSession(sessionId);

/**
 * Ownership check for a session.
 * @returns {Promise<{owned: boolean, reason: string}>}
 *   owned=true  → the caller may read and delete the session
 *   owned=false → the caller gets 404 (never 403: that would leak existence)
 */
export const sessionAccess = async (sessionId, { userId = null, capability = null } = {}) => {
  const ownership = await loadSessionOwnership(sessionId);
  if (!ownership) return { owned: false, reason: 'NOT_FOUND' };

  // Authenticated owner.
  if (ownership.user_id) {
    if (userId && ownership.user_id === userId) return { owned: true, reason: 'USER' };
    return { owned: false, reason: 'NOT_FOUND' };
  }

  // Anonymous session: only the holder of the capability may touch it.
  if (capabilityMatches(ownership.capability_hash, capability)) {
    return { owned: true, reason: 'CAPABILITY' };
  }
  return { owned: false, reason: 'NOT_FOUND' };
};

/** True when the session id exists at all (used to avoid 404/403 leaks). */
export const sessionExists = async (sessionId) => !!(await loadSessionOwnership(sessionId));

export const saveSession = async (session) => {
  await persistSession(session);
  return session;
};

export const clearSession = async (sessionId) => {
  const pool = await getPool();
  const { rowCount } = await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
  if (!rowCount) {
    return { success: false, session_id: sessionId };
  }
  return { success: true, session_id: sessionId, persisted: true };
};