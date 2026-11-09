import { describe, it, expect } from 'vitest';
import { preScore } from '../src/services/recommend.service.js';

const basePersona = {
  budget_level: 'mid_range',
  spice_tolerance: 'medium',
  ambience_preference: 'casual_dining',
  social_context: 'family_outing',
  preferred_cuisines: [],
  value_sensitivity: 'value_seeker',
};

const restaurant = {
  price_tier: 'mid_range',
  spice_profile: 'medium',
  ambience: 'casual_dining',
  social_tags: ['family_outing'],
  cuisine_tags: [],
};

describe('preScore', () => {
  it('rewards a value preference that matches the price tier', () => {
    const priceConscious = preScore(restaurant, { ...basePersona, value_sensitivity: 'price_conscious' });
    const valueSeeker = preScore(restaurant, { ...basePersona, value_sensitivity: 'value_seeker' });

    expect(valueSeeker).toBeGreaterThan(priceConscious);
    expect(valueSeeker - priceConscious).toBeCloseTo(0.15, 5);
  });

  it('ignores an unknown value preference instead of throwing', () => {
    expect(() =>
      preScore(restaurant, { ...basePersona, value_sensitivity: 'mystery' })
    ).not.toThrow();
  });

  it('stays within the documented 0–1.1 relevance range', () => {
    const score = preScore(
      { ...restaurant, cuisine_tags: ['Yoruba'] },
      { ...basePersona, preferred_cuisines: ['Yoruba'] }
    );

    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1.1 + Number.EPSILON);
  });
});
