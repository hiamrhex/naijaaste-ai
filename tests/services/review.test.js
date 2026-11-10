import { describe, it, expect, vi, beforeEach } from 'vitest';

const deps = vi.hoisted(() => ({
  callReviewLLM: vi.fn(),
  findRestaurantByCode: vi.fn(),
}));

vi.mock('../../src/services/llm.service.js', () => ({
  callReviewLLM: deps.callReviewLLM,
}));

vi.mock('../../src/db/catalogue.js', () => ({
  findRestaurantByCode: deps.findRestaurantByCode,
}));

const { generateReview } = await import('../../src/services/review.service.js');

const persona = {
  persona_id: 'persona-1',
  full_name: 'Amara',
  age: 30,
  city: 'Lagos',
  occupation: 'Teacher',
  income_level: 'middle',
  budget_level: 'mid_range',
  spice_tolerance: 'medium',
  ambience_preference: 'casual_dining',
  social_context: 'family_outing',
  preferred_cuisines: ['Yoruba'],
  dietary_flags: ['none'],
};

const restaurant = {
  restaurant_id: 'r-1',
  name: 'Mama Cass',
  area: 'Yaba',
  city: 'Lagos',
  price_tier: 'mid_range',
  price_range_naira: { min: 2000, max: 6000 },
  cuisine_tags: ['Yoruba'],
  signature_dishes: ['Jollof rice'],
  spice_profile: 'medium',
  ambience: 'casual_dining',
  social_tags: ['family_outing'],
  dietary_options: ['halal', 'vegetarian'],
};

const reviewResult = {
  review_text: 'The jollof was smoky and the room was warm.',
  rating: 4.5,
};

beforeEach(() => {
  deps.callReviewLLM.mockReset();
  deps.findRestaurantByCode.mockReset();
  deps.callReviewLLM.mockResolvedValue({ ...reviewResult });
});

describe('generateReview', () => {
  it('returns the review with server-computed metadata', async () => {
    const result = await generateReview(persona, restaurant);

    expect(result.success).toBe(true);
    expect(result.restaurant_id).toBe('r-1');
    expect(result.restaurant_name).toBe('Mama Cass');
    expect(result.review_text).toBe(reviewResult.review_text);
    expect(result.meta.pre_match_score).toBe(1);
    expect(result.meta.compatibility_issues).toBeNull();
    expect(typeof result.meta.latency_ms).toBe('number');
  });

  it('resolves a restaurant from the catalogue when only an id is given', async () => {
    deps.findRestaurantByCode.mockResolvedValue(restaurant);

    const result = await generateReview(persona, { restaurant_id: 'r-1' });

    expect(deps.findRestaurantByCode).toHaveBeenCalledWith('r-1');
    expect(result.restaurant_name).toBe('Mama Cass');
  });

  it('fails cleanly when the id is not in the catalogue', async () => {
    deps.findRestaurantByCode.mockResolvedValue(null);

    const result = await generateReview(persona, { restaurant_id: 'missing' });

    expect(result).toMatchObject({ success: false });
    expect(result.error).toMatch(/not found/);
    expect(deps.callReviewLLM).not.toHaveBeenCalled();
  });

  it('does not crash when the persona has no city', async () => {
    const { city: _city, ...citylessPersona } = persona;

    await expect(generateReview(citylessPersona, restaurant)).resolves.toMatchObject({
      success: true,
    });
  });

  it('does not crash when the restaurant has no city', async () => {
    const { city: _city2, ...citylessRestaurant } = restaurant;

    await expect(generateReview(persona, citylessRestaurant)).resolves.toMatchObject({
      success: true,
    });
  });

  it('records a city mismatch instead of hiding it', async () => {
    const result = await generateReview(persona, { ...restaurant, city: 'Abuja' });

    expect(result.meta.compatibility_issues).toEqual(
      expect.arrayContaining([expect.stringContaining('Persona is from Lagos')])
    );
  });

  it('flags a halal diner at a restaurant without halal options', async () => {
    const result = await generateReview(
      { ...persona, dietary_flags: ['halal'] },
      { ...restaurant, dietary_options: [] }
    );

    expect(result.meta.compatibility_issues).toContain('halal_violation');
  });

  it('does not flag a halal diner at a halal restaurant', async () => {
    const result = await generateReview(
      { ...persona, dietary_flags: ['halal'] },
      restaurant
    );

    expect(result.meta.compatibility_issues).toBeNull();
  });

  it('keeps server-owned fields even if the model returns them', async () => {
    deps.callReviewLLM.mockResolvedValue({
      ...reviewResult,
      success: false,
      restaurant_id: 'someone-else',
      restaurant_name: 'Invented Place',
      persona_id: 'fake-persona',
    });

    const result = await generateReview(persona, restaurant);

    expect(result.success).toBe(true);
    expect(result.restaurant_id).toBe('r-1');
    expect(result.restaurant_name).toBe('Mama Cass');
    expect(result.persona_id).toBe('persona-1');
  });

  it('counts words without being fooled by extra whitespace', async () => {
    deps.callReviewLLM.mockResolvedValue({
      review_text: '  Smoky   jollof,  warm  room.  ',
    });

    const result = await generateReview(persona, restaurant);

    expect(result.meta.review_word_count).toBe(4);
  });

  it('reports zero words when the model returns no text', async () => {
    deps.callReviewLLM.mockResolvedValue({});

    const result = await generateReview(persona, restaurant);

    expect(result.meta.review_word_count).toBe(0);
  });
});

