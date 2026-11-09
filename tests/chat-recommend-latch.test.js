import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';

// This suite needs several chat turns; keep the limiter out of the way.
process.env.RATE_LIMIT_LLM_MAX = '500';
process.env.RATE_LIMIT_API_MAX = '5000';

const mocks = vi.hoisted(() => ({
  getRecommendations: vi.fn(),
  llmReply: {
    message: 'Ready to recommend',
    stage: 'recommend',
    extracted_persona: { preference_history: [] },
    missing_fields: [],
    ready_to_recommend: true,
  },
}));

vi.mock('../src/services/llm.service.js', () => ({
  callLLMJson: async () => mocks.llmReply,
  callLLM: async () => '{}',
  callPersonaLLM: async () => ({}),
  callReviewLLM: async () => ({}),
  callRecommendLLM: async () => ({}),
  LLM_TOTAL_TIMEOUT_MS: 25000,
  LLM_TIMEOUT_MS: 12000,
  LlmTimeoutError: class LlmTimeoutError extends Error {},
  LlmUnavailableError: class LlmUnavailableError extends Error {},
  withTimeout: (p) => p,
}));

vi.mock('../src/services/recommend.service.js', () => ({
  getRecommendations: mocks.getRecommendations,
}));

let app;
let token;

const picks = {
  success: true,
  recommendations: [
    {
      rank: 1,
      restaurant_id: 'r-1',
      restaurant_name: 'Mama Cass',
      match_score: 0.9,
      reasoning: 'Great jollof',
      predicted_rating: 4.5,
      why_they_will_love_it: 'Smoky party jollof.',
      potential_concern: null,
    },
  ],
  meta: { after_hard_filter: 7, candidates_sent_to_llm: 5 },
};

beforeAll(async () => {
  ({ app } = await import('../src/app.js'));
  const res = await request(app)
    .post('/auth/signup')
    .send({
      name: 'Latch Tester',
      email: `latch${Date.now()}@example.com`,
      password: 'Str0ng!Passw0rd',
    });
  token = res.body.accessToken;
});

beforeEach(() => {
  mocks.getRecommendations.mockReset();
});

const postChat = (message, sessionId) =>
  request(app)
    .post('/api/v1/chat')
    .set({ Authorization: `Bearer ${token}` })
    .send(sessionId ? { message, session_id: sessionId } : { message });

describe('chat recommendation latch', () => {
  it('retries on the next turn after a zero-match recommendation', async () => {
    mocks.getRecommendations
      .mockResolvedValueOnce({ success: false, recommendations: [], error: 'no matches' })
      .mockResolvedValueOnce(picks);

    const first = await postChat('I want jollof');
    expect(first.status).toBe(200);
    expect(first.body.recommendations).toBeNull();

    const second = await postChat('Actually anything spicy works', first.body.session_id);
    expect(second.status).toBe(200);
    expect(second.body.recommendations.recommendations).toHaveLength(1);
    expect(second.body.recommendations.recommendations[0].restaurant_name).toBe('Mama Cass');

    expect(mocks.getRecommendations).toHaveBeenCalledTimes(2);
  });

  it('does not call the recommender again once picks are latched', async () => {
    mocks.getRecommendations.mockResolvedValue(picks);

    const first = await postChat('I want jollof');
    expect(first.body.recommendations.recommendations).toHaveLength(1);

    const second = await postChat('Thanks!', first.body.session_id);
    expect(second.body.recommendations.recommendations).toHaveLength(1);

    expect(mocks.getRecommendations).toHaveBeenCalledTimes(1);
  });
});
