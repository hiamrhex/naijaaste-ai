import { describe, it, expect, vi } from 'vitest';

// Regression: getRecommendations checked the monthly quota itself and then
// callRecommendLLM (which owns the check) charged it again, so every
// recommendation consumed two calls. The quota belongs to the LLM layer;
// the recommender must not pre-charge it.

const mocks = vi.hoisted(() => ({
  increment: vi.fn(async () => ({ allowed: true, remaining: 99, limit: 100, warned: false })),
}));

vi.mock('../src/services/llm-quota.service.js', () => ({
  checkAndIncrementQuota: mocks.increment,
  getQuotaStatus: vi.fn(),
}));

vi.mock('../src/services/llm.service.js', () => ({
  callRecommendLLM: async () => {
    const err = new Error('Gemini down for test');
    err.code = 'CIRCUIT_OPEN';
    throw err;
  },
}));

const { getRecommendations } = await import('../src/services/recommend.service.js');

const persona = {
  persona_id: 'quota-double-charge',
  city: 'Lagos',
  budget_level: 'mid_range',
  spice_tolerance: 'hot',
  ambience_preference: 'casual_dining',
  social_context: 'friends',
  preferred_cuisines: ['Street Food'],
  dietary_flags: ['none'],
  preference_history: [],
};

describe('recommendation quota accounting', () => {
  it('does not pre-charge the quota before the LLM layer', async () => {
    const res = await getRecommendations(persona, { quotaSubject: { id: 'p-1', type: 'persona' } });
    expect(res.success).toBe(true);
    expect(mocks.increment).not.toHaveBeenCalled();
  });
});
