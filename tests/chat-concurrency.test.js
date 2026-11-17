import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';

// Two turns for the same session (two tabs, a double-tapped send) used to load
// the same row, append to separate copies and write back unconditionally. The
// later write replaced the earlier turn's message, so one user message vanished
// without an error. The write is now conditional on the revision that was
// loaded, and the loser gets 409 SESSION_CONFLICT.

process.env.RATE_LIMIT_LLM_MAX = '500';
process.env.RATE_LIMIT_API_MAX = '5000';

const mocks = vi.hoisted(() => ({ llm: vi.fn() }));

vi.mock('../src/services/llm.service.js', () => ({
  callLLMJson: (...args) => mocks.llm(...args),
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

import { verifiedToken } from './helpers/session.js';

let app;
let token;

const reply = {
  message: 'Tell me more',
  stage: 'gather',
  extracted_persona: { preference_history: [] },
  missing_fields: ['city'],
  ready_to_recommend: false,
};

const postChat = (message, sessionId) =>
  request(app)
    .post('/api/v1/chat')
    .set({ Authorization: `Bearer ${token}` })
    .send(sessionId ? { message, session_id: sessionId } : { message });

beforeAll(async () => {
  ({ app } = await import('../src/app.js'));
  token = await verifiedToken(app, `chat-race-${Date.now()}@example.com`, { name: 'Concurrency Tester' });});

beforeEach(() => {
  mocks.llm.mockReset();
});

describe('concurrent chat turns', () => {
  it('refuses the losing turn instead of silently discarding it', async () => {
    mocks.llm.mockResolvedValue(reply);

    const created = await postChat('I want jollof');
    expect(created.status).toBe(200);
    const sessionId = created.body.session_id;

    // Both turns now load the session, then wait on the model. Neither can
    // write until both have read, which is the exact interleaving that lost a
    // message before.
    mocks.llm.mockReset();
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    mocks.llm.mockImplementation(() => gate.then(() => reply));

    const first = postChat('first concurrent message', sessionId).then((r) => r);
    const second = postChat('second concurrent message', sessionId).then((r) => r);

    for (let i = 0; i < 200 && mocks.llm.mock.calls.length < 2; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(mocks.llm.mock.calls.length).toBe(2);
    release();

    const results = await Promise.all([first, second]);
    const statuses = results.map((r) => r.status).sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);

    const refused = results.find((r) => r.status === 409);
    expect(refused.body.error.code).toBe('SESSION_CONFLICT');

    // Exactly one of the two messages is in the stored history: the winner's.
    // The loser was told to retry rather than being told it succeeded.
    const state = await request(app)
      .get(`/api/v1/chat/${sessionId}`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);

    const contents = state.body.session.conversation_history.map((m) => m.content);
    const concurrent = contents.filter((c) => c.endsWith('concurrent message'));
    expect(concurrent).toHaveLength(1);

    const winner = results.find((r) => r.status === 200);
    expect(winner.body.message).toBe('Tell me more');
  });

  it('accepts the next turn after a refused one', async () => {
    mocks.llm.mockResolvedValue(reply);

    const created = await postChat('start');
    const sessionId = created.body.session_id;

    const next = await postChat('after the conflict', sessionId);
    expect(next.status).toBe(200);
  });
});
