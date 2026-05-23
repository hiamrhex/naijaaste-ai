import { buildChatSystemPrompt, buildChatUserPrompt } from '../prompts/chat.prompt.js';
import { callLLMJson } from './llm.service.js';
import { getRecommendations } from './recommend.service.js';
import { v4 as uuidv4 } from 'uuid';
import { readFileSync, writeFile, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSIONS_FILE = join(__dirname, '../data/sessions.json');

// Session expiry — 24 hours
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// Write queue — prevents race conditions on concurrent writes
let writeQueue = Promise.resolve();

// ─── Persistent Session Store ─────────────────────────────────────────────────
const loadSessions = () => {
  try {
    if (!existsSync(SESSIONS_FILE)) return {};
    const raw = readFileSync(SESSIONS_FILE, 'utf-8');
    const all = JSON.parse(raw);

    // Prune expired sessions on load
    const now = Date.now();
    return Object.fromEntries(
      Object.entries(all).filter(([_, s]) =>
        now - new Date(s.last_active).getTime() < SESSION_TTL_MS
      )
    );
  } catch {
    return {};
  }
};

// Async write with queue — prevents race conditions
const saveSessions = (sessions) => {
  writeQueue = writeQueue.then(
    () =>
      new Promise((resolve) => {
        writeFile(
          SESSIONS_FILE,
          JSON.stringify(sessions, null, 2),
          'utf-8',
          (err) => {
            if (err) console.error('[chat] Session persist failed:', err.message);
            resolve();
          }
        );
      })
  );
};

// Load on startup
let sessionStore = loadSessions();

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
  if (!sessionStore[sessionId]) {
    sessionStore[sessionId] = {
      session_id: sessionId,
      conversation_history: [],
      extracted_persona: { preference_history: [] },
      stage: 'gather',
      recommendations: null,
      created_at: new Date().toISOString(),
      last_active: new Date().toISOString()
    };
  }

  const session = sessionStore[sessionId];
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
      console.error('[chat] Recommendation failed:', err.message);
    }
  }

  // Persist asynchronously — non-blocking, queued
  sessionStore[sessionId] = session;
  saveSessions(sessionStore);

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
      session_persisted: true,
      last_active: session.last_active,
      latency_ms: Date.now() - startTime
    }
  };
};

export const getSession = (sessionId) => sessionStore[sessionId] || null;

export const clearSession = (sessionId) => {
  delete sessionStore[sessionId];
  saveSessions(sessionStore);
  return { success: true, session_id: sessionId };
};