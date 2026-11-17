import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';

// This suite needs several chat turns; keep the limiter out of the way.
process.env.RATE_LIMIT_LLM_MAX = '500';
process.env.RATE_LIMIT_API_MAX = '5000';

const mocks = vi.hoisted(() => ({
  getRecommendations: vi.fn(),
  llmCalls: [],
  llmReply: {
    message: 'Ready to recommend',
    stage: 'recommend',
    extracted_persona: { preference_history: [] },
    missing_fields: [],
    ready_to_recommend: true,
  },
}));

vi.mock('../src/services/llm.service.js', () => ({
  callLLMJson: async (...args) => {
    mocks.llmCalls.push(args);
    return mocks.llmReply;
  },
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

import { signupVerified } from './helpers/session.js';

let app;
let token;
let userId;

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
  const session = await signupVerified(app, `latch${Date.now()}@example.com`, { name: 'Latch Tester' });
  token = session.accessToken;
  userId = session.user.id;
});

beforeEach(() => {
  mocks.getRecommendations.mockReset();
  mocks.llmCalls.length = 0;
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

  it('forwards the recommender counts so the results badges can render', async () => {
    mocks.getRecommendations.mockResolvedValue(picks);

    const res = await postChat('I want jollof');

    expect(res.body.meta.after_hard_filter).toBe(7);
    expect(res.body.meta.candidates_sent_to_llm).toBe(5);
  });

  it('meters the nested recommendation call with the caller quota subject', async () => {
    // A chat turn can make two model calls (chat + recommendation). The second
    // one used to go out with no subject, so it never counted toward the
    // monthly quota even though the service comment says one increment per call.
    mocks.getRecommendations.mockResolvedValue(picks);

    await postChat('I want jollof');

    const [, options] = mocks.getRecommendations.mock.calls[0];
    expect(options.quotaSubject).toEqual({ id: userId, type: 'user' });
  });

  it('meters the first anonymous turn and never stores the raw capability', async () => {
    // The capability is minted during the creation turn, so deriving the quota
    // subject from `owner` alone left every anonymous first turn unmetered:
    // create session → one free model call → discard → repeat.
    mocks.getRecommendations.mockResolvedValue(picks);

    const res = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'hello' });

    expect(res.status).toBe(200);
    const raw = res.body.session_capability;
    expect(typeof raw).toBe('string');

    const [, , options] = mocks.llmCalls[0];
    expect(options.quotaSubject.type).toBe('capability');
    expect(options.quotaSubject.id).toMatch(/^[0-9a-f]{64}$/);
    expect(options.quotaSubject.id).not.toBe(raw);
  });
});
