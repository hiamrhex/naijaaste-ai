import { GoogleGenAI } from "@google/genai";
import { logger } from "../lib/logger.js";
import { env } from "../env.js";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

// Model chain. The configured model is tried first; when it hangs, 404s or
// is overloaded we walk down the chain instead of failing the request.
// (gemini-3.8-flash was observed hanging >30s on 2026-10-20 while
// gemini-3.5-flash-lite answered in ~0.6s — a hung model is what pushed the
// Vercel function past maxDuration and produced the plain-text platform
// error. See probes/gemini-probe.mjs.)
export const MODEL_FALLBACKS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
];

// New default — works reliably as of 2026-10. The env var still wins in prod.
export const MODEL = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

// Ordered list actually used: configured model first (if it differs from the
// built-in chain), then the fallbacks. Duplicates removed.
export const MODEL_CHAIN = [...new Set([MODEL, ...MODEL_FALLBACKS])].filter(Boolean);

// Token limits per endpoint — review needs less, recommend needs more
const TOKEN_LIMITS = {
  persona: 800,
  review: 1200,
  recommend: 2500,
  default: 1500
};

// Clean markdown fence variations (models occasionally wrap JSON in ``` fences)
const cleanJSON = (raw) => {
  return raw
    .replace(/^```(?:json|JSON)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .replace(/^`|`$/g, '')
    .trim();
};

// Exponential backoff retry
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Vercel kills api/index.js at vercel.json maxDuration = 60s with a plain-text
// platform body. Our own deadline must land before that, leaving headroom for
// Express to serialise the JSON error. Retries AND backoff share this budget.
export const FUNCTION_MAX_DURATION_MS = 60000;
export const LLM_TOTAL_TIMEOUT_MS = Math.min(
  env.GEMINI_TOTAL_TIMEOUT_MS,
  FUNCTION_MAX_DURATION_MS - 10000
);

// Per-attempt ceiling; the total deadline above always wins because each
// attempt is clamped to the time remaining.
export const LLM_TIMEOUT_MS = Math.min(
  env.GEMINI_ATTEMPT_TIMEOUT_MS,
  LLM_TOTAL_TIMEOUT_MS
);

export class LlmTimeoutError extends Error {
  constructor(ms) {
    super(`LLM budget exhausted after ${ms}ms (attempts and retries included)`);
    this.name = 'LlmTimeoutError';
    this.code = 'LLM_TIMEOUT';
    this.timeoutMs = ms;
  }
}

// The provider answered, but with an error (503 high demand, 429, 404 model
// gone, 401 bad key). Distinct from a timeout: the client contract is
// AI_UNAVAILABLE, not AI_TIMEOUT.
export class LlmUnavailableError extends Error {
  constructor(message, cause) {
    super(message || 'LLM provider unavailable');
    this.name = 'LlmUnavailableError';
    this.code = 'LLM_UNAVAILABLE';
    this.status = 503;
    if (cause) this.cause = cause;
  }
}

export const withTimeout = (promise, ms, onTimeout) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      try { onTimeout?.(); } catch { /* abort is best-effort */ }
      reject(new LlmTimeoutError(ms));
    }, ms);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

// Degraded model cache: a model that timed out / 404 / 5xx is marked
// unhealthy for a short window so subsequent calls skip it immediately.
const DEGRADE_TTL_MS = {
  timeout: 10 * 60 * 1000,       // 10m — a hang is a strong signal, not a blip
  not_found: 6 * 60 * 60 * 1000, // 6h — model not found is permanent for this key
  server_error: 60_000,
};
const degraded = new Map(); // model -> expiry timestamp

// Models observed to hang (never answer) for this API key, so every cold
// start would otherwise burn the per-attempt timeout before falling back.
// Seeded as degraded for the first TTL window; if the model recovers it is
// retried after the window and stays healthy from then on.
// Evidence: probes/gemini-probe.mjs (2026-10-20) — gemini-3.8-flash and
// gemini-3.7-flash did not answer within 30s while gemini-3.5-flash-lite
// answered in ~0.6s.
const KNOWN_SLOW_MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash'];
for (const model of KNOWN_SLOW_MODELS) {
  degraded.set(model, Date.now() + DEGRADE_TTL_MS.timeout);
}

// A known-slow model gets a cheap probe instead of the full attempt budget:
// if it has recovered it answers within a few seconds, and if it has not we
// move on in seconds instead of stalling the request.
const PROBE_TIMEOUT_MS = 5000;

const isDegraded = (model) => (degraded.get(model) || 0) > Date.now();
const markDegraded = (model, err) => {
  let ttl = DEGRADE_TTL_MS.server_error;
  if (err?.code === 'LLM_TIMEOUT') ttl = DEGRADE_TTL_MS.timeout;
  const status = typeof err?.status === 'number' ? err.status : 0;
  if (status === 404) ttl = DEGRADE_TTL_MS.not_found;
  degraded.set(model, Date.now() + ttl);
};

// Circuit breaker factory (item 6). Closed → failures counted; at threshold
// the breaker opens for coolDownMs and calls fail fast without touching the
// network; one probe is allowed after cooldown (half-open), closing on
// success. Pure logic, fully unit-tested; one shared instance guards callLLM.
export const createBreaker = ({ threshold = 5, coolDownMs = 60000, now = Date.now } = {}) => {
  let failures = 0;
  let openedAt = null;
  return {
    get state() {
      if (openedAt === null) return 'closed';
      if (now() - openedAt >= coolDownMs) return 'half-open';
      return 'open';
    },
    get failures() { return failures; },
    async exec(fn) {
      if (this.state === 'open') {
        const err = new Error('LLM circuit is open — upstream failing, request skipped');
        err.code = 'CIRCUIT_OPEN';
        throw err;
      }
      try {
        const out = await fn();
        failures = 0;
        openedAt = null;
        return out;
      } catch (err) {
        failures += 1;
        if (failures >= threshold) openedAt = now();
        throw err;
      }
    },
    reset() { failures = 0; openedAt = null; },
  };
};

export const llmBreaker = createBreaker();

/**
 * Single generateContent call with abort + timeout. Returns the raw response.
 */
const callOnce = async (model, { contents, config = {} } = {}, attemptMs) => {
  const controller = new AbortController();
  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model,
        contents,
        config: {
          ...config,
          abortSignal: controller.signal,
        },
      }),
      attemptMs,
      () => controller.abort()
    );
    return response;
  } finally {
    controller.abort();
  }
};

/**
 * Walk MODEL_CHAIN, skipping degraded models. Each model gets one attempt
 * bounded by the remaining deadline. The first success clears its degraded
 * flag and returns. On model-specific failures (timeout, 404, 5xx) the model
 * is marked degraded and we continue to the next model. Auth errors (401/403)
 * abort the chain immediately — no model will help.
 */
export const generateContentWithFallback = async (
  { contents, config = {} } = {},
  { deadline = Date.now() + LLM_TOTAL_TIMEOUT_MS } = {}
) => {
  const chain = MODEL_CHAIN.filter(m => !isDegraded(m));
  const models = chain.length ? chain : [MODEL_CHAIN[0]];
  let lastError;

  for (const model of models) {
    const remaining = deadline - Date.now();
    // Budget gone: the caller gets AI_TIMEOUT, not a provider error.
    if (remaining <= 0) throw new LlmTimeoutError(LLM_TOTAL_TIMEOUT_MS);

    // A model that has hung before is probed cheaply; a healthy one gets the
    // full attempt budget.
    const attemptMs = KNOWN_SLOW_MODELS.includes(model)
      ? Math.min(PROBE_TIMEOUT_MS, remaining)
      : Math.min(LLM_TIMEOUT_MS, remaining);

    try {
      const response = await callOnce(model, { contents, config }, attemptMs);
      degraded.delete(model); // success → clear degraded
      return { response, model };
    } catch (err) {
      lastError = err;
      const status = typeof err?.status === 'number' ? err.status : 0;
      const isAuthError = status === 401 || status === 403;
      markDegraded(model, err);
      logger.warn({ model, status, code: err?.code, budget_left_ms: deadline - Date.now() }, 'llm model attempt failed');
      if (isAuthError) throw err; // key problem: no model will help
    }
  }

  throw lastError || new LlmTimeoutError(LLM_TOTAL_TIMEOUT_MS);
};

/**
 * Normalise a provider failure into our two client-facing codes:
 * LLM_TIMEOUT (our budget expired) or LLM_UNAVAILABLE (provider said no).
 */
const normaliseProviderError = (err) => {
  if (!err) return new LlmUnavailableError('LLM provider unavailable');
  if (err.code === 'LLM_TIMEOUT' || err.code === 'CIRCUIT_OPEN') return err;
  const status = typeof err?.status === 'number' ? err.status : 0;
  const message = String(err?.message || '');
  const isRateLimit = status === 429 || /resource[_ ]exhausted|rate limit|429/i.test(message);
  if (isRateLimit || status === 404 || status === 401 || status === 403 || status >= 500) {
    return new LlmUnavailableError('LLM provider unavailable', err);
  }
  // Unknown provider error: treat as unavailable, never as our own timeout.
  return new LlmUnavailableError('LLM provider unavailable', err);
};

/**
 * Core LLM call — single combined prompt goes as user message.
 * System instruction sets JSON-only behaviour globally.
 *
 * `budgetMs` lets callers (e.g. the agent loop) spend from a larger shared
 * request budget; it is always clamped by the module-level ceiling.
 */
export const callLLM = async (
  prompt,
  tokenLimit = TOKEN_LIMITS.default,
  { budgetMs = LLM_TOTAL_TIMEOUT_MS } = {}
) => {
  const budget = Math.max(1, Math.min(budgetMs, LLM_TOTAL_TIMEOUT_MS));
  const deadline = Date.now() + budget;

  return llmBreaker.exec(async () => {
    let lastError;
    while (Date.now() < deadline) {
      try {
        const { response } = await generateContentWithFallback(
          {
            contents: prompt,
            config: {
              maxOutputTokens: tokenLimit,
              systemInstruction:
                "You are an elite AI assistant. You ALWAYS return valid JSON only. No markdown. No explanation. No preamble. Raw JSON only."
            }
          },
          { deadline }
        );

        const text = response.text;
        if (!text) {
          const reason = response.candidates?.[0]?.finishReason ?? "unknown";
          throw new Error(`Gemini returned no text (finishReason=${reason})`);
        }
        return text.trim();
      } catch (err) {
        lastError = err;
        const status = typeof err?.status === 'number' ? err.status : 0;
        const isRateLimit = status === 429 || /resource[_ ]exhausted|rate limit|429/i.test(String(err?.message || ""));
        if (!isRateLimit) break; // chain already tried other models
        const delay = 1000 + Math.random() * 500;
        if (Date.now() + delay >= deadline) break;
        await sleep(delay);
      }
    }

    if (lastError?.code === 'LLM_TIMEOUT') throw lastError;
    // Provider answered with an error: AI_UNAVAILABLE (503), not AI_TIMEOUT.
    throw normaliseProviderError(lastError);
  });
};

/**
 * Calls LLM and returns parsed JSON.
 * Transport/upstream failures rethrow immediately (no wasted corrective
 * call on an undefined response); only genuine parse failures get the
 * corrective retry.
 */
export const callLLMJson = async (
  prompt,
  tokenLimit = TOKEN_LIMITS.default,
  { budgetMs = LLM_TOTAL_TIMEOUT_MS } = {}
) => {
  // One deadline covers the primary call, its retries, AND the corrective
  // call — otherwise a slow model could spend two full budgets.
  const budget = Math.max(1, Math.min(budgetMs, LLM_TOTAL_TIMEOUT_MS));
  const deadline = Date.now() + budget;

  // Transport/upstream failures propagate untouched — no wasted corrective
  // call on an undefined response (used to embed "previous response: undefined").
  const raw = await callLLM(prompt, tokenLimit, { budgetMs: budget });

  try {
    const clean = cleanJSON(raw);
    return JSON.parse(clean);
  } catch (parseError) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new LlmTimeoutError(LLM_TOTAL_TIMEOUT_MS);

    // Corrective retry — tell LLM exactly what went wrong
    logger.warn({ err: parseError, budget_left_ms: remaining }, 'llm json parse failed, corrective retry');

    const correctivePrompt = `
Your previous response failed JSON parsing with this error: ${parseError.message}

Your previous response was:
${raw}

Return ONLY valid JSON. No markdown fences. No explanation. 
Start your response with { and end with }.
    `.trim();

    const correctedRaw = await callLLM(correctivePrompt, tokenLimit, { budgetMs: remaining });
    const correctedClean = cleanJSON(correctedRaw);
    return JSON.parse(correctedClean);
  }
};

/**
 * Persona extraction — lower tokens, higher temperature for variety
 */
export const callPersonaLLM = async (prompt) => {
  return callLLMJson(prompt, TOKEN_LIMITS.persona);
};

/**
 * Review generation
 */
export const callReviewLLM = async (prompt) => {
  return callLLMJson(prompt, TOKEN_LIMITS.review);
};

/**
 * Recommendation — needs highest token limit for 5+ ranked results
 */
export const callRecommendLLM = async (prompt) => {
  return callLLMJson(prompt, TOKEN_LIMITS.recommend);
};