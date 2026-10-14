import { GoogleGenAI } from "@google/genai";
import { logger } from "../lib/logger.js";
import { env } from "../env.js";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

const MODEL = env.GEMINI_MODEL;

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

// Per-attempt timeout: a hung upstream must never pin a request (or a
// Vercel invocation) forever. 20s keeps worst-case inside the 60s budget.
export const LLM_TIMEOUT_MS = 20000;

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => {
        const err = new Error(`LLM call timed out after ${ms}ms`);
        err.code = 'LLM_TIMEOUT';
        reject(err);
      }, ms)
    ),
  ]);

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

const withRetry = async (fn, retries = 3, baseDelay = 1000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // GoogleGenAI ApiError exposes .status; fall back to message sniffing
      const status = typeof error?.status === "number" ? error.status : 0;
      const message = String(error?.message || "");
      const isRateLimit =
        status === 429 || /resource[_ ]exhausted|rate limit|429/i.test(message);
      const isRetryable = isRateLimit || status === 422 || status >= 500;

      if (!isRetryable || attempt === retries) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500;
      logger.warn(
        { attempt, retries, delay_ms: Math.round(delay), status: error?.status },
        'llm call failed, retrying'
      );
      await sleep(delay);
    }
  }
};

/**
 * Core LLM call — single combined prompt goes as user message.
 * System instruction sets JSON-only behaviour globally.
 */
export const callLLM = async (prompt, tokenLimit = TOKEN_LIMITS.default) => {
  return llmBreaker.exec(() => withRetry(async () => {
    const response = await withTimeout(ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        maxOutputTokens: tokenLimit,
        systemInstruction:
          "You are an elite AI assistant. You ALWAYS return valid JSON only. No markdown. No explanation. No preamble. Raw JSON only."
      }
    }), LLM_TIMEOUT_MS);

    const text = response.text;
    if (!text) {
      const reason = response.candidates?.[0]?.finishReason ?? "unknown";
      throw new Error(`Gemini returned no text (finishReason=${reason})`);
    }

    return text.trim();
  }));
};

/**
 * Calls LLM and returns parsed JSON.
 * Transport/upstream failures rethrow immediately (no wasted corrective
 * call on an undefined response); only genuine parse failures get the
 * corrective retry.
 */
export const callLLMJson = async (prompt, tokenLimit = TOKEN_LIMITS.default) => {
  // Transport/upstream failures propagate untouched — no wasted corrective
  // call on an undefined response (used to embed "previous response: undefined").
  const raw = await callLLM(prompt, tokenLimit);

  try {
    const clean = cleanJSON(raw);
    return JSON.parse(clean);
  } catch (parseError) {
    // Corrective retry — tell LLM exactly what went wrong
    logger.warn({ err: parseError }, 'llm json parse failed, corrective retry');

    const correctivePrompt = `
Your previous response failed JSON parsing with this error: ${parseError.message}

Your previous response was:
${raw}

Return ONLY valid JSON. No markdown fences. No explanation. 
Start your response with { and end with }.
    `.trim();

    const correctedRaw = await callLLM(correctivePrompt, tokenLimit);
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
