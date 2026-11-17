import { describe, it, expect, vi } from 'vitest';

// get_recommendations received the persona the model extracted and then threw
// it away: session.extracted_persona stayed { preference_history: [] } for the
// whole conversation. The taste-profile card was empty, and a later review had
// no persona to write from.

vi.mock('../src/services/recommend.service.js', () => ({
  getRecommendations: async () => ({ success: true, recommendations: [] }),
}));

const { executeTool } = await import('../src/agent/tools.js');

const extracted = {
  city: 'Lagos',
  budget_level: 'mid_range',
  spice_tolerance: 'hot',
  ambience_preference: 'buka',
  preferred_cuisines: ['Yoruba', 'Street Food'],
  dietary_flags: ['halal'],
};

describe('agent persona persistence', () => {
  it('stores the persona the model extracted for recommendations', async () => {
    const session = { extracted_persona: { preference_history: [] } };

    await executeTool('get_recommendations', { persona: extracted }, session);

    expect(session.extracted_persona).toMatchObject(extracted);
    // The history is server-owned and must survive the merge.
    expect(session.extracted_persona.preference_history).toEqual([]);
  });

  it('keeps preference signals recorded before the recommendation', async () => {
    const signal = { signal_id: 's1', dimension: 'spice', value: 'hot', rating: 5 };
    const session = { extracted_persona: { preference_history: [signal] } };

    await executeTool('get_recommendations', { persona: extracted }, session);

    expect(session.extracted_persona.preference_history).toEqual([signal]);
    expect(session.extracted_persona.city).toBe('Lagos');
  });

  it('does not store an incomplete persona when city is missing', async () => {
    const session = { extracted_persona: { preference_history: [] } };

    const result = await executeTool('get_recommendations', { persona: { budget_level: 'mid' } }, session);

    expect(result.error).toMatch(/city/i);
    expect(session.extracted_persona).toEqual({ preference_history: [] });
  });
});
