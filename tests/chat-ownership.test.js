import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';

// This suite creates many chat turns; the LLM limiter (10/min by default)
// would answer 429 and mask the ownership assertions.
process.env.RATE_LIMIT_LLM_MAX = '500';
process.env.RATE_LIMIT_API_MAX = '5000';

// The chat turn never reaches Gemini here — ownership is decided before any
// model call, so the LLM is mocked to a canned reply.
vi.mock('../src/services/llm.service.js', () => ({
  callLLMJson: async () => ({
    message: 'mocked reply',
    stage: 'gather',
    extracted_persona: { preference_history: [] },
    missing_fields: ['city'],
    ready_to_recommend: false,
  }),
  callLLM: async () => '{}',
  callPersonaLLM: async () => ({}),
  callReviewLLM: async () => ({}),
  callRecommendLLM: async () => ({}),
  LLM_TOTAL_TIMEOUT_MS: 25000,
  LLM_TIMEOUT_MS: 12000,
  LlmTimeoutError: class LlmTimeoutError extends Error { },
  LlmUnavailableError: class LlmUnavailableError extends Error { },
  withTimeout: (p) => p,
}));

let app;
let serverless;
let tokenA;
let tokenB;

const stamp = Date.now();

const signup = async (name, email) => {
  const res = await request(app).post('/auth/signup').send({ name, email, password: 'Str0ng!Passw0rd' });
  return res.body.accessToken;
};

beforeAll(async () => {
  ({ app } = await import('../src/app.js'));
  ({ default: serverless } = await import('../api/index.js'));
  tokenA = await signup('Owner A', `owner${stamp}@example.com`);
  tokenB = await signup('Intruder B', `intruder${stamp}@example.com`);
});

// Every mount the API is served on:
//   /api/v1/...  → canonical
//   /...         → legacy root mount
//   /api/...     → only exists behind the Vercel rewrite (api/index.js
//     strips the prefix); it is exercised through the serverless handler
//     in the last test of this file.
// The ownership rules must hold identically on all of them.
const MOUNTS = ['/api/v1', ''];

const auth = (t) => ({ Authorization: `Bearer ${t}` });

describe('chat session ownership (independent review D-1 / IQ-26)', () => {
  for (const mount of MOUNTS) {
    describe(`mount ${mount || '(root)'}`, () => {
      it('a signed-in owner can read and delete their own session', async () => {
        const created = await request(app)
          .post(`${mount}/chat`)
          .set(auth(tokenA))
          .send({ message: 'I love jollof in Lagos' })
          .expect(200);
        const sid = created.body.session_id;

        const read = await request(app).get(`${mount}/chat/${sid}`).set(auth(tokenA)).expect(200);
        expect(read.body.session.session_id).toBe(sid);

        await request(app).delete(`${mount}/chat/${sid}`).set(auth(tokenA)).expect(200);
        await request(app).get(`${mount}/chat/${sid}`).set(auth(tokenA)).expect(404);
      });

      it("another user's session is 404 for GET and DELETE (no existence oracle)", async () => {
        const created = await request(app)
          .post(`${mount}/chat`)
          .set(auth(tokenA))
          .send({ message: 'private conversation' })
          .expect(200);
        const sid = created.body.session_id;

        const read = await request(app).get(`${mount}/chat/${sid}`).set(auth(tokenB));
        expect(read.status).toBe(404);
        expect(read.body.error.code).toBe('SESSION_NOT_FOUND');

        const del = await request(app).delete(`${mount}/chat/${sid}`).set(auth(tokenB));
        expect(del.status).toBe(404);

        // The session is untouched: the owner still has it.
        await request(app).get(`${mount}/chat/${sid}`).set(auth(tokenA)).expect(200);
      });

      it('an anonymous session is unreadable and undeletable without its capability', async () => {
        const created = await request(app)
          .post(`${mount}/chat`)
          .send({ message: 'anonymous conversation' })
          .expect(200);
        const sid = created.body.session_id;
        const capability = created.body.session_capability;
        expect(typeof capability).toBe('string');
        expect(capability.length).toBeGreaterThan(20);

        // No token at all.
        await request(app).get(`${mount}/chat/${sid}`).expect(404);
        // Someone else's access token.
        await request(app).get(`${mount}/chat/${sid}`).set(auth(tokenB)).expect(404);
        // A wrong capability.
        await request(app).get(`${mount}/chat/${sid}`).set(auth('not-the-capability')).expect(404);
        await request(app).delete(`${mount}/chat/${sid}`).set(auth('not-the-capability')).expect(404);

        // Still there for the real holder.
        const mine = await request(app).get(`${mount}/chat/${sid}`).set(auth(capability)).expect(200);
        expect(mine.body.session.session_id).toBe(sid);
      });

      it('the capability holder can delete the anonymous session, nobody else can', async () => {
        const created = await request(app)
          .post(`${mount}/chat`)
          .send({ message: 'delete me' })
          .expect(200);
        const sid = created.body.session_id;
        const capability = created.body.session_capability;

        // Another user cannot delete it.
        await request(app).delete(`${mount}/chat/${sid}`).set(auth(tokenB)).expect(404);

        // The holder can.
        await request(app).delete(`${mount}/chat/${sid}`).set(auth(capability)).expect(200);
        await request(app).get(`${mount}/chat/${sid}`).set(auth(capability)).expect(404);
      });

      it('another user cannot continue someone else\'s session', async () => {
        const created = await request(app)
          .post(`${mount}/chat`)
          .set(auth(tokenA))
          .send({ message: 'mine' })
          .expect(200);
        const sid = created.body.session_id;

        const res = await request(app)
          .post(`${mount}/chat`)
          .set(auth(tokenB))
          .send({ message: 'let me in', session_id: sid });
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
      });

      it('unknown and malformed ids stay 404/400', async () => {
        await request(app).get(`${mount}/chat/${randomUUID()}`).expect(404);
        await request(app).get(`${mount}/chat/not-a-uuid`).expect(400);
      });
    });
  }

  it('the Vercel serverless entry enforces the same rules on /api/chat/:id', async () => {
    const created = await request(app)
      .post('/api/v1/chat')
      .set(auth(tokenA))
      .send({ message: 'through the function entry' })
      .expect(200);
    const sid = created.body.session_id;

    // api/index.js strips the /api prefix, so /api/chat/:id must behave
    // exactly like /chat/:id.
    await request(serverless).get(`/api/chat/${sid}`).set(auth(tokenB)).expect(404);
    await request(serverless).get(`/api/chat/${sid}`).set(auth(tokenA)).expect(200);
    await request(serverless).delete(`/api/chat/${sid}`).set(auth(tokenA)).expect(200);
  });
});
