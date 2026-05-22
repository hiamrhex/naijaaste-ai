import { 
  buildColdStartRecommendPrompt, 
  buildWarmRecommendPrompt 
} from '../prompts/recommend.prompt.js';
import { callRecommendLLM } from './llm.service.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const allRestaurants = JSON.parse(
  readFileSync(join(__dirname, '../data/restaurants.json'), 'utf-8')
);

// ─── Hard Filters ─────────────────────────────────────────────────────────────
const applyHardFilters = (persona) => {
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

// ─── Main Service ─────────────────────────────────────────────────────────────
export const getRecommendations = async (persona) => {
  const startTime = Date.now();

  // Step 1 — Hard filter
  const hardFiltered = applyHardFilters(persona);

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
  const candidates = hardFiltered
    .map(r => ({ ...r, _pre_score: preScore(r, persona) }))
    .sort((a, b) => b._pre_score - a._pre_score)
    .slice(0, 15)
    .map(({ _pre_score, ...r }) => r); // remove internal score before sending to LLM

  // Step 3 — Detect user state
  const warm = isWarmUser(persona);

  // Step 4 — Build prompt based on user state
  const prompt = warm
    ? buildWarmRecommendPrompt(persona, candidates)
    : buildColdStartRecommendPrompt(persona, candidates);

  // Step 5 — Call LLM with correct token limit and retry logic
  const llmResult = await callRecommendLLM(prompt);

  // Step 6 — Return with full metadata for judges
  return {
    success: true,
    ...llmResult,
    meta: {
      user_state: warm ? 'warm' : 'cold_start',
      persona_id: persona.persona_id,
      total_restaurants_in_city: allRestaurants.filter(
        r => r.city.toLowerCase() === persona.city.toLowerCase()
      ).length,
      after_hard_filter: hardFiltered.length,
      candidates_sent_to_llm: candidates.length,
      history_signals: persona.preference_history?.length || 0,
      latency_ms: Date.now() - startTime
    }
  };
};