// ─── NaijaTaste AI — Evaluation Script ───────────────────────────────────────
// Computes NDCG@5 for recommendation quality
// Computes RMSE for rating prediction accuracy
// Run: node src/evaluate.js

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getRecommendations } from './services/recommend.service.js';
import { generateReview } from './services/review.service.js';
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const restaurants = JSON.parse(
  readFileSync(join(__dirname, 'data/restaurants.json'), 'utf-8')
);

// ─── Scoring weights (must match recommend.service.js) ───────────────────────
const WEIGHTS = {
  budget_level: 0.30,
  ambience_preference: 0.25,
  spice_tolerance: 0.20,
  value_sensitivity: 0.15,
  social_context: 0.10
};

const spiceMap = { mild: 1, medium: 2, hot: 3, extra_hot: 4 };

// Compute ideal relevance score for a restaurant-persona pair
const computeRelevance = (restaurant, persona) => {
  let score = 0;

  if (restaurant.price_tier === persona.budget_level)
    score += WEIGHTS.budget_level;
  if (restaurant.ambience === persona.ambience_preference)
    score += WEIGHTS.ambience_preference;

  const pSpice = spiceMap[persona.spice_tolerance] || 2;
  const rSpice = spiceMap[restaurant.spice_profile] || 2;
  const diff = Math.abs(pSpice - rSpice);
  if (diff === 0) score += WEIGHTS.spice_tolerance;
  else if (diff === 1) score += WEIGHTS.spice_tolerance * 0.5;

  if (restaurant.social_tags?.includes(persona.social_context))
    score += WEIGHTS.social_context;

  const cuisineMatch = persona.preferred_cuisines?.some(c =>
    restaurant.cuisine_tags?.includes(c)
  );
  if (cuisineMatch) score += 0.1;

  return parseFloat(score.toFixed(3));
};

// ─── NDCG@K computation ───────────────────────────────────────────────────────
const dcg = (relevances, k) => {
  return relevances.slice(0, k).reduce((sum, rel, i) => {
    return sum + rel / Math.log2(i + 2);
  }, 0);
};

const ndcgAtK = (predicted, ideal, k) => {
  const idealDcg = dcg(ideal.slice(0, k), k);
  if (idealDcg === 0) return 0;
  return dcg(predicted.slice(0, k), k) / idealDcg;
};

// ─── Test Personas ────────────────────────────────────────────────────────────
const TEST_PERSONAS = [
  {
    persona_id: 'eval-001',
    full_name: 'Test Student Lagos',
    age: 22, city: 'Lagos', occupation: 'Student',
    income_level: 'low', budget_level: 'budget',
    spice_tolerance: 'hot', ambience_preference: 'buka',
    value_sensitivity: 'price_conscious', social_context: 'solo',
    preferred_cuisines: ['Yoruba', 'Street Food'],
    dietary_flags: ['none'], preference_history: [],
    created_at: new Date().toISOString()
  },
  {
    persona_id: 'eval-002',
    full_name: 'Test Executive Abuja',
    age: 45, city: 'Abuja', occupation: 'Senior Banker',
    income_level: 'high', budget_level: 'premium',
    spice_tolerance: 'mild', ambience_preference: 'fine_dining',
    value_sensitivity: 'quality_first', social_context: 'business_lunch',
    preferred_cuisines: ['Afro-fusion', 'Lagos Contemporary'],
    dietary_flags: ['none'], preference_history: [],
    created_at: new Date().toISOString()
  },
  {
    persona_id: 'eval-003',
    full_name: 'Test Family Port Harcourt',
    age: 35, city: 'Port Harcourt', occupation: 'Engineer',
    income_level: 'middle', budget_level: 'mid_range',
    spice_tolerance: 'medium', ambience_preference: 'casual_dining',
    value_sensitivity: 'value_seeker', social_context: 'family_outing',
    preferred_cuisines: ['Delta', 'Street Food'],
    dietary_flags: ['none'], preference_history: [],
    created_at: new Date().toISOString()
  },
  {
    persona_id: 'eval-004',
    full_name: 'Test Muslim Kano',
    age: 30, city: 'Kano', occupation: 'Civil Servant',
    income_level: 'middle', budget_level: 'mid_range',
    spice_tolerance: 'medium', ambience_preference: 'casual_dining',
    value_sensitivity: 'value_seeker', social_context: 'family_outing',
    preferred_cuisines: ['Hausa-Fulani', 'Suya-Grills'],
    dietary_flags: ['halal', 'no_pork', 'no_alcohol'],
    preference_history: [], created_at: new Date().toISOString()
  },
  {
    persona_id: 'eval-005',
    full_name: 'Test Date Night Lagos',
    age: 28, city: 'Lagos', occupation: 'Marketing Manager',
    income_level: 'middle', budget_level: 'mid_range',
    spice_tolerance: 'medium', ambience_preference: 'fine_dining',
    value_sensitivity: 'value_seeker', social_context: 'date_night',
    preferred_cuisines: ['Lagos Contemporary', 'Afro-fusion'],
    dietary_flags: ['none'], preference_history: [],
    created_at: new Date().toISOString()
  }
];

// ─── Run Evaluation ───────────────────────────────────────────────────────────
const runEvaluation = async () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   NaijaTaste AI — Evaluation Run     ║');
  console.log('╚══════════════════════════════════════╝\n');

  const ndcgScores = [];
  const rmseErrors = [];
  const reviewResults = [];

  for (const persona of TEST_PERSONAS) {
    console.log(`\n── Evaluating: ${persona.full_name} (${persona.city})`);

    try {
      // Get recommendations from system
      const result = await getRecommendations(persona);

      if (!result.success || !result.recommendations) {
        console.log(`  ✗ No recommendations returned`);
        continue;
      }

      const recommended = result.recommendations;

      // Compute ideal ranking for this persona's city
      const cityRestaurants = restaurants.filter(
        r => r.city.toLowerCase() === persona.city.toLowerCase()
      );

      const idealRanking = cityRestaurants
        .map(r => ({ ...r, relevance: computeRelevance(r, persona) }))
        .sort((a, b) => b.relevance - a.relevance);

      const idealRelevances = idealRanking.map(r => r.relevance);

      // Get predicted relevances in recommended order
      const predictedRelevances = recommended.map(rec => {
        const restaurant = cityRestaurants.find(
          r => r.restaurant_id === rec.restaurant_id ||
               r.name === rec.restaurant_name
        );
        return restaurant ? computeRelevance(restaurant, persona) : 0;
      });

      // Compute NDCG@5
      const ndcg5 = ndcgAtK(predictedRelevances, idealRelevances, 5);
      ndcgScores.push(ndcg5);
      console.log(`  ✓ NDCG@5: ${ndcg5.toFixed(4)}`);

      // Compute RMSE for predicted ratings
      for (const rec of recommended.slice(0, 3)) {
        const restaurant = cityRestaurants.find(
          r => r.name === rec.restaurant_name
        );
        if (!restaurant || !rec.predicted_rating) continue;

        const expectedRating = 1 + computeRelevance(restaurant, persona) * 4;
        const error = Math.pow(rec.predicted_rating - expectedRating, 2);
        rmseErrors.push(error);
      }

      // Test review generation for top recommendation
      if (recommended[0]) {
        const topRestaurant = cityRestaurants.find(
          r => r.name === recommended[0].restaurant_name
        );
        if (topRestaurant) {
          const review = await generateReview(persona, topRestaurant);
          if (review.success) {
            reviewResults.push({
              persona: persona.full_name,
              restaurant: topRestaurant.name,
              star_rating: review.star_rating,
              word_count: review.meta?.review_word_count,
              persona_match: review.persona_match_score
            });
            console.log(`  ✓ Review generated — ${review.meta?.review_word_count} words, ${review.star_rating}★`);
          }
        }
      }

    } catch (err) {
      console.log(`  ✗ Error: ${err.message}`);
    }
  }

  // ─── Final Metrics ──────────────────────────────────────────────────────────
  const avgNdcg = ndcgScores.length
    ? ndcgScores.reduce((a, b) => a + b, 0) / ndcgScores.length
    : 0;

  const rmse = rmseErrors.length
    ? Math.sqrt(rmseErrors.reduce((a, b) => a + b, 0) / rmseErrors.length)
    : 0;

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║         EVALUATION RESULTS           ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  Personas tested:    ${TEST_PERSONAS.length}               ║`);
  console.log(`║  NDCG@5 (avg):       ${avgNdcg.toFixed(4)}            ║`);
  console.log(`║  RMSE (ratings):     ${rmse.toFixed(4)}            ║`);
  console.log(`║  Reviews generated:  ${reviewResults.length}               ║`);
  console.log('╚══════════════════════════════════════╝\n');

  console.log('Individual NDCG scores:');
  TEST_PERSONAS.forEach((p, i) => {
    if (ndcgScores[i] !== undefined) {
      console.log(`  ${p.full_name}: ${ndcgScores[i].toFixed(4)}`);
    }
  });

  console.log('\nReview samples:');
  reviewResults.forEach(r => {
    console.log(`  ${r.persona} @ ${r.restaurant}: ${r.star_rating}★ (${r.word_count} words, match: ${r.persona_match})`);
  });

  console.log('\n✓ Save these numbers for your solution paper.\n');
};

runEvaluation().catch(console.error);