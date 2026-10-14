import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/services/llm.service.js', () => ({
  callRecommendLLM: async () => {
    const err = new Error('Gemini down for test');
    err.code = 'CIRCUIT_OPEN';
    throw err;
  },
}));

import { getRecommendations } from '../src/services/recommend.service.js';

const persona = {
  persona_id: 'fallback-probe',
  city: 'Lagos',
  budget_level: 'mid_range',
  spice_tolerance: 'hot',
  ambience_preference: 'casual_dining',
  social_context: 'friends',
  preferred_cuisines: ['Street Food'],
  dietary_flags: ['none'],
  preference_history: [],
};

describe('deterministic fallback when Gemini is down (item 6)', () => {
  it('returns success:true with labeled fallback picks, not a 502 dead end', async () => {
    const res = await getRecommendations(persona);
    expect(res.success).toBe(true);
    expect(res.fallback).toBe(true);
    expect(res.message).toMatch(/deterministic/i);
    expect(res.recommendations.length).toBeGreaterThan(0);
    expect(res.recommendations.length).toBeLessThanOrEqual(5);
    for (const [i, r] of res.recommendations.entries()) {
      expect(r.rank).toBe(i + 1);
      expect(typeof r.restaurant_id).toBe('string');
      expect(typeof r.restaurant_name).toBe('string');
      expect(r.match_score).toBeGreaterThanOrEqual(0);
      expect(r.match_score).toBeLessThanOrEqual(1);
      expect(typeof r.reasoning).toBe('string');
    }
    expect(res.meta.candidates_sent_to_llm).toBe(0);
    expect(res.meta.fallback_reason).toBe('CIRCUIT_OPEN');
  });

  it('still hard-fails zero-match personas (fallback must not invent rows)', async () => {
    const res = await getRecommendations({ ...persona, city: 'Nowhere-Zzz' });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/No restaurants match/);
  });
});
