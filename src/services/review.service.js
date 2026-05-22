import { buildReviewPrompt } from '../prompts/review.prompt.js';
import { callReviewLLM } from './llm.service.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const allRestaurants = JSON.parse(
  readFileSync(join(__dirname, '../data/restaurants.json'), 'utf-8')
);

// Validate persona-restaurant compatibility before calling LLM
// Catches dietary violations and city mismatches early
const validateCompatibility = (persona, restaurant) => {
  const issues = [];

  // City mismatch — reviewer visiting a restaurant outside their city
  if (persona.city.toLowerCase() !== restaurant.city.toLowerCase()) {
    issues.push(`Persona is from ${persona.city} but restaurant is in ${restaurant.city}`);
  }

  // Dietary flag violations
  if (persona.dietary_flags?.length > 0) {
    const flags = persona.dietary_flags;
    if (flags.includes('halal') && !restaurant.dietary_options?.includes('halal')) {
      issues.push('halal_violation');
    }
    if (flags.includes('no_pork') && restaurant.dietary_options?.includes('pork')) {
      issues.push('pork_violation');
    }
    if (flags.includes('vegetarian') && !restaurant.dietary_options?.includes('vegetarian')) {
      issues.push('vegetarian_violation');
    }
  }

  return issues;
};

// Compute persona-restaurant match score before LLM call
// Used to set expectations in the prompt and validate output
const computePreMatchScore = (persona, restaurant) => {
  let score = 1.0;

  // Budget mismatch penalty
  if (persona.budget_level !== restaurant.price_tier) score -= 0.2;

  // Spice mismatch penalty
  const spiceMap = { mild: 1, medium: 2, hot: 3, extra_hot: 4 };
  const pSpice = spiceMap[persona.spice_tolerance] || 2;
  const rSpice = spiceMap[restaurant.spice_profile] || 2;
  const diff = Math.abs(pSpice - rSpice);
  if (diff === 1) score -= 0.1;
  if (diff >= 2) score -= 0.25;

  // Ambience mismatch penalty
  if (persona.ambience_preference !== restaurant.ambience) score -= 0.15;

  // Social context mismatch
  if (!restaurant.social_tags?.includes(persona.social_context)) score -= 0.1;

  return Math.max(0, Math.min(1, parseFloat(score.toFixed(2))));
};

export const generateReview = async (persona, restaurant) => {
  const startTime = Date.now();

  // Step 1 — Resolve restaurant from catalogue if only id provided
  let resolvedRestaurant = restaurant;
  if (!restaurant.name && restaurant.restaurant_id) {
    resolvedRestaurant = allRestaurants.find(
      r => r.restaurant_id === restaurant.restaurant_id
    );
    if (!resolvedRestaurant) {
      return {
        success: false,
        error: `Restaurant with id ${restaurant.restaurant_id} not found in catalogue`
      };
    }
  }

  // Step 2 — Validate compatibility
  const issues = validateCompatibility(persona, resolvedRestaurant);

  // Step 3 — Pre-compute match score
  const preMatchScore = computePreMatchScore(persona, resolvedRestaurant);

  // Step 4 — Build prompt and call LLM
  const prompt = buildReviewPrompt(persona, resolvedRestaurant);
  const llmResult = await callReviewLLM(prompt);

  // Step 5 — Return with full metadata
  return {
    success: true,
    persona_id: persona.persona_id,
    restaurant_id: resolvedRestaurant.restaurant_id,
    restaurant_name: resolvedRestaurant.name,
    ...llmResult,
    meta: {
      pre_match_score: preMatchScore,
      compatibility_issues: issues.length > 0 ? issues : null,
      review_word_count: llmResult.review_text?.split(' ').length || 0,
      latency_ms: Date.now() - startTime
    }
  };
};