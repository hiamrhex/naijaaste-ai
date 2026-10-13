import { buildChatSystemPrompt, buildChatUserPrompt } from '../prompts/chat.prompt.js';
import { callLLMJson } from './llm.service.js';
import { getRecommendations } from './recommend.service.js';
import { getPool } from '../db/pool.js';
import { logger } from '../lib/logger.js';
import { v4 as uuidv4 } from 'uuid';

// Session expiry — 24 hours
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

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
const persistSession = async (session) => {
  try {
    const pool = await getPool();
    await pool.query(
      `INSERT INTO sessions (id, user_id, data, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, data = EXCLUDED.data, updated_at = now()`,
      [session.session_id, session.user_id || null, JSON.stringify(session)]
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
export const processChat = async (sessionId, userMessage) => {
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
  let session = await loadSession(sessionId);
  if (!session) session = blankSession(sessionId);

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

  const llmResponse = await callLLMJson(combinedPrompt, 1500);

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
  const persisted = await persistSession(session);

  return {
    success: true,
    session_id: sessionId,
    stage: session.stage,
    message: llmResponse.message,
    recommendations: recommendations || session.recommendations || null,
    extracted_persona: session.extracted_persona,
    missing_fields: llmResponse.missing_fields || [],
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