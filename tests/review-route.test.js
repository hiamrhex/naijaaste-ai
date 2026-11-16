import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';

// The UI posts the recommendation card it is showing: a ranked pick with
// restaurant_id/restaurant_name and none of the catalogue fields. The route
// schema demanded a full restaurant object, so every "Write my review" click
// answered 400 and the hook swallowed the error — the button did nothing.
//
// The persona sent from the chat is the agent's extracted persona, which has no
// persona_id until a recommendation has been generated. The route must accept
// what the app actually sends and resolve the restaurant from the catalogue.

vi.mock('../src/services/llm.service.js', () => ({
  callReviewLLM: async () => ({
    review_text: 'The jollof dey slap, no cap. Worth every kobo.',
    star_rating: 4,
    highlight_tags: ['jollof', 'value'],
    persona_match_score: 0.82,
  }),
  callLLM: async () => '{}',
  callLLMJson: async () => ({}),
  callPersonaLLM: async () => ({}),
  callRecommendLLM: async () => ({}),
  generateContentWithFallback: async () => ({}),
  LLM_TOTAL_TIMEOUT_MS: 25000,
  LLM_TIMEOUT_MS: 12000,
  LlmTimeoutError: class LlmTimeoutError extends Error {},
  LlmUnavailableError: class LlmUnavailableError extends Error {},
  withTimeout: (p) => p,
}));

let app;

beforeAll(async () => {
  ({ app } = await import('../src/app.js'));
});

// Exactly the shape ResultsSection/RestaurantCard hands to onReview.
const recommendationCard = {
  rank: 1,
  restaurant_id: 'r001',
  restaurant_name: 'Test Spot',
  match_score: 0.91,
  reasoning: 'Matches your Lagos search',
  predicted_rating: 4.2,
  why_they_will_love_it: 'Known for jollof.',
  potential_concern: null,
};

// Exactly the shape the agent returns as extracted_persona.
const extractedPersona = {
  city: 'Lagos',
  budget_level: 'mid_range',
  spice_tolerance: 'medium',
  preference_history: [],
};

describe('POST /generate-review', () => {
  it('accepts the recommendation card the UI actually sends', async () => {
    const res = await request(app)
      .post('/generate-review')
      .send({ persona: extractedPersona, restaurant: recommendationCard })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.review_text).toMatch(/jollof/i);
    // Identity comes from the catalogue row, not from the card.
    expect(res.body.restaurant_id).toBe('r001');
    expect(res.body.restaurant_name).toBeTruthy();
  });

  it('resolves a restaurant given only its id', async () => {
    const res = await request(app)
      .post('/generate-review')
      .send({
        persona: { ...extractedPersona, persona_id: 'p-1' },
        restaurant: { restaurant_id: 'r002' },
      })
      .expect(200);

    expect(res.body.restaurant_id).toBe('r002');
  });

  it('reviews an OSM-sourced row that has no price range or tags', async () => {
    // Imported OSM rows have no meta, so mapRow leaves price_range_naira null
    // and every tag list empty. The prompt reads price_range_naira.min and
    // joins those lists, so it threw on exactly these rows.
    const { getPool } = await import('../src/db/pool.js');
    const pool = await getPool();
    const osmId = `node/${Date.now()}`;
    await pool.query(
      `INSERT INTO restaurants (osm_id, name, city, lat, lng)
       VALUES ($1, 'OSM Buka', 'Lagos', 6.5, 3.4)`,
      [osmId]
    );

    const res = await request(app)
      .post('/generate-review')
      .send({
        persona: extractedPersona,
        restaurant: { restaurant_id: osmId },
      })
      .expect(200);

    expect(res.body.restaurant_id).toBe(osmId);
  });

  it('still rejects a request with no restaurant at all', async () => {
    const res = await request(app)
      .post('/generate-review')
      .send({ persona: extractedPersona, restaurant: {} })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('still rejects an unknown restaurant id', async () => {
    const res = await request(app)
      .post('/generate-review')
      .send({
        persona: extractedPersona,
        restaurant: { restaurant_id: 'not-a-real-restaurant' },
      })
      .expect(404);

    expect(res.body.error.code).toBe('RESTAURANT_NOT_FOUND');
  });
});
