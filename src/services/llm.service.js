import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = "llama-3.3-70b-versatile";

// Token limits per endpoint — review needs less, recommend needs more
const TOKEN_LIMITS = {
  persona: 800,
  review: 1200,
  recommend: 2500,
  default: 1500
};

// Clean all known Groq markdown fence variations
const cleanJSON = (raw) => {
  return raw
    .replace(/^```(?:json|JSON)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .replace(/^`|`$/g, '')
    .trim();
};

// Exponential backoff retry
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async (fn, retries = 3, baseDelay = 1000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimit = error?.status === 429;
      const isRetryable = isRateLimit || error?.status === 422 || error?.status >= 500;

      if (!isRetryable || attempt === retries) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500;
      console.warn(`LLM call failed (attempt ${attempt}/${retries}). Retrying in ${Math.round(delay)}ms...`);
      await sleep(delay);
    }
  }
};

/**
 * Core LLM call — single combined prompt goes as user message.
 * System message sets JSON-only behaviour globally.
 */
export const callLLM = async (prompt, tokenLimit = TOKEN_LIMITS.default) => {
  return withRetry(async () => {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: tokenLimit,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "You are an elite AI assistant. You ALWAYS return valid JSON only. No markdown. No explanation. No preamble. Raw JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    return completion.choices[0].message.content.trim();
  });
};

/**
 * Calls LLM and returns parsed JSON.
 * Retries with corrective prompt if JSON parsing fails.
 */
export const callLLMJson = async (prompt, tokenLimit = TOKEN_LIMITS.default) => {
  let raw;

  try {
    raw = await callLLM(prompt, tokenLimit);
    const clean = cleanJSON(raw);
    return JSON.parse(clean);
  } catch (parseError) {
    // Corrective retry — tell LLM exactly what went wrong
    console.warn('JSON parse failed. Attempting corrective retry...');

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