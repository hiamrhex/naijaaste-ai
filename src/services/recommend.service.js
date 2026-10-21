import {
  buildColdStartRecommendPrompt,
  buildWarmRecommendPrompt
} from '../prompts/recommend.prompt.js';
import { callRecommendLLM } from './llm.service.js';
import { getCatalogueByCity } from '../db/catalogue.js';
import { logger } from '../lib/logger.js';

// ─── Hard Filters ─────────────────────────────────────────────────────────────
// Exported so the deterministic fallback can honour the same dietary rules —
// a halal diner must never be shown a pork option, AI or not.
export const hardFilterRestaurants = (allRestaurants, persona) => {
  return allRestaurants.filter((r) => {
    // City match — non-negotiable
    if (r.city.toLowerCase() !== persona.city.toLowerCase()) return false;

    // Dietary flag violations — eliminate completely
    if (persona.dietary_flags?.length > 0) {
      const flags = persona.dietary_flags;
      if (flags.includes('halal') && !r.dietary_options?.includes('halal')) return false;
      if (flags.includes('vegetarian') && !r.dietary_options?.includes('vegetarian')) return false;
      if (flags.includes('no_pork') && r.dietary_options?.includes('pork')) return false;
      if (flags.includes('no_alcohol') && r.dietary_options?.includes('alcohol')) return false;
      if (flags.includes('low_oil') && r.dietary_options?.includes('high_oil')) return false;
    }

    return true;
  });
};

const applyHardFilters = hardFilterRestaurants;

// ─── Pre-Scoring ──────────────────────────────────────────────────────────────
// Narrow candidate pool before sending to LLM
// Improves LLM focus and recommendation quality
const WEIGHTS = {
  budget_level: 0.30,
  ambience_preference: 0.25,
  spice_tolerance: 0.20,
  value_sensitivity: 0.15,
  social_context: 0.10
};

const preScore = (restaurant, persona) => {
  let score = 0;

  // Budget match
  if (restaurant.price_tier === persona.budget_level) 
    score += WEIGHTS.budget_level;
  else if (
    (persona.budget_level === 'mid_range' && restaurant.price_tier === 'budget') ||
    (persona.budget_level === 'premium' && restaurant.price_tier === 'mid_range')
  ) score += WEIGHTS.budget_level * 0.5; // partial credit

  // Ambience match
  if (restaurant.ambience === persona.ambience_preference)
    score += WEIGHTS.ambience_preference;

  // Spice match
  const spiceMap = { mild: 1, medium: 2, hot: 3, extra_hot: 4 };
  const personaSpice = spiceMap[persona.spice_tolerance] || 2;
  const restSpice = spiceMap[restaurant.spice_profile] || 2;
  const spiceDiff = Math.abs(personaSpice - restSpice);
  if (spiceDiff === 0) score += WEIGHTS.spice_tolerance;
  else if (spiceDiff === 1) score += WEIGHTS.spice_tolerance * 0.5;

  // Social context match
  if (restaurant.social_tags?.includes(persona.social_context))
    score += WEIGHTS.social_context;

  // Cuisine preference boost
  const cuisineMatch = persona.preferred_cuisines?.some(c =>
    restaurant.cuisine_tags?.includes(c)
  );
  if (cuisineMatch) score += 0.1; // bonus

  return score;
};

// ─── Warm User Detection ──────────────────────────────────────────────────────
const isWarmUser = (persona) =>
  Array.isArray(persona.preference_history) &&
  persona.preference_history.length > 0;

// ─── Deterministic fallback (item 6) ──────────────────────────────────────────
// When the LLM is down/slow/throttled, users still get honest ranked picks
// from the same pre-score the LLM path uses — same shape, clearly labeled,
// zero invented prose.
const FALLBACK_MESSAGE =
  'Live AI ranking is unavailable right now — these are deterministic picks from your taste match. Try again shortly for AI reasoning.';

const toFallbackRec = (r, i) => ({
  rank: i + 1,
  restaurant_id: r.restaurant_id,
  restaurant_name: r.name,
  match_score: Math.min(1, Math.round((r._pre_score || 0) * 100) / 100),
  reasoning: `Matches your ${r.city} search on price (${r.price_tier || 'varied'}) and spice (${r.spice_profile || 'varied'}) — ranked deterministically while AI ranking is down.`,
  predicted_rating: typeof r.average_rating === 'number' ? r.average_rating : 3.5,
  why_they_will_love_it: r.signature_dishes?.[0]
    ? `Known for ${r.signature_dishes[0]}.`
    : 'A solid match on your stated preferences.',
  potential_concern: null,
});

const fallbackResult = (persona, scored, totalInCity, startTime, reason) => ({
  success: true,
  fallback: true,
  recommendations: scored.slice(0, 5).map(toFallbackRec),
  message: FALLBACK_MESSAGE,
  persona_summary: `Deterministic shortlist for ${persona.city || 'your city'}.`,
  meta: {
    user_state: isWarmUser(persona) ? 'warm' : 'cold_start',
    persona_id: persona.persona_id,
    total_restaurants_in_city: totalInCity,
    after_hard_filter: scored.length,
    candidates_sent_to_llm: 0,
    history_signals: persona.preference_history?.length || 0,
    latency_ms: Date.now() - startTime,
    fallback_reason: reason?.code || String(reason?.message || reason),
  },
});

// ─── Standalone deterministic path (no LLM at all) ─────────────────────────────
// Used by the chat/agent fallback: when the model is slow or dead we still
// answer with real catalogue rows ranked by the same pre-score, so the user
// gets useful picks instead of an error page. Never touches Gemini.
export const getDeterministicRecommendations = async (persona, reason = 'LLM_UNAVAILABLE') => {
  const startTime = Date.now();
  const city = persona?.city || 'Lagos';
  const cityRestaurants = await getCatalogueByCity(city);
  const hardFiltered = applyHardFilters(cityRestaurants, { ...persona, city });
  if (hardFiltered.length === 0) {
    return {
      success: false,
      fallback: true,
      error: 'No restaurants match persona constraints',
      recommendations: [],
      message: `No ${city} spots match those constraints right now.`,
      meta: { fallback_reason: reason, latency_ms: Date.now() - startTime },
    };
  }
  const scored = hardFiltered
    .map(r => ({ ...r, _pre_score: preScore(r, { ...persona, city }) }))
    .sort((a, b) => b._pre_score - a._pre_score);
  return fallbackResult({ ...persona, city }, scored, cityRestaurants.length, startTime, { code: reason });
};

// ─── Main Service ─────────────────────────────────────────────────────────────
export const getRecommendations = async (persona) => {
  const startTime = Date.now();

  // City pushdown: the DB returns only this city's rows (scales past 100k).
  const cityRestaurants = await getCatalogueByCity(persona.city);

  // Step 1 — Hard filter
  const hardFiltered = applyHardFilters(cityRestaurants, persona);

  if (hardFiltered.length === 0) {
    return {
      success: false,
      error: 'No restaurants match persona constraints',
      debug: { city: persona.city, dietary_flags: persona.dietary_flags },
      persona_id: persona.persona_id
    };
  }

  // Step 2 — Pre-score and take top 15 candidates for LLM
  // Prevents context bloat and improves LLM ranking quality
  const scored = hardFiltered
    .map(r => ({ ...r, _pre_score: preScore(r, persona) }))
    .sort((a, b) => b._pre_score - a._pre_score);
  const candidates = scored
    .slice(0, 15)
    .map(({ _pre_score, ...r }) => r); // remove internal score before sending to LLM

  // Step 3 — Detect user state
  const warm = isWarmUser(persona);

  // Step 4 — Build prompt based on user state
  const prompt = warm
    ? buildWarmRecommendPrompt(persona, candidates)
    : buildColdStartRecommendPrompt(persona, candidates);

  // Step 5 — Call LLM with correct token limit and retry logic.
  // On LLM failure (down, slow, throttled, circuit open): degrade to the
  // deterministic picks with a clear message instead of a 502 dead end.
  let llmResult;
  try {
    llmResult = await callRecommendLLM(prompt);
  } catch (err) {
    logger.warn({ err: err?.code || err?.message }, 'recommend LLM failed, deterministic fallback');
    return fallbackResult(persona, scored, cityRestaurants.length, startTime, err);
  }

  // Step 6 — Return with full metadata for judges
  return {
    success: true,
    ...llmResult,
    meta: {
      user_state: warm ? 'warm' : 'cold_start',
      persona_id: persona.persona_id,
      total_restaurants_in_city: cityRestaurants.length,
      after_hard_filter: hardFiltered.length,
      candidates_sent_to_llm: candidates.length,
      history_signals: persona.preference_history?.length || 0,
      latency_ms: Date.now() - startTime
    }
  };
};