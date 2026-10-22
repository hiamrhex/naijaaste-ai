import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';

// Several agent turns in this file; the LLM limiter (10/min) would answer
// 429 and mask the ownership assertions. vi.hoisted runs before the imports
// below, so the app is built with the raised budget.
vi.hoisted(() => {
  process.env.RATE_LIMIT_LLM_MAX = '500';
  process.env.RATE_LIMIT_API_MAX = '5000';
});

import { app } from '../src/app.js';

// Plan 012: agent never reaches the LLM here — ownership/validation happen
// before (403) or the loop is mocked (200 paths).
vi.mock('../src/agent/agent.js', () => ({
  runAgent: async () => ({ text: 'mocked reply', trace: [] }),
}));

const stamp = Date.now();

const signup = async (name, email) => {
  const res = await request(app).post('/auth/signup').send({ name, email, password: 'Str0ng!Passw0rd' });
  return res.body.accessToken;
};

const tokenA = await signup('Owner A', `owner${stamp}@example.com`);
const tokenB = await signup('Intruder B', `intruder${stamp}@example.com`);
const auth = (t) => ({ Authorization: `Bearer ${t}` });

describe('session params + ownership (plan 012)', () => {
  it('non-UUID session ids are 400, not 404', async () => {
    await request(app).get('/chat/not-a-uuid').set(auth(tokenA)).expect(400);
    await request(app).delete('/chat/__proto__').set(auth(tokenA)).expect(400);
  });

  it('well-formed unknown UUIDs stay 404', async () => {
    const id = randomUUID();
    await request(app).get(`/chat/${id}`).set(auth(tokenA)).expect(404);
    await request(app).delete(`/chat/${id}`).set(auth(tokenA)).expect(404);
  });

  it('another user reusing my agent session gets 403', async () => {
    const created = await request(app).post('/agent')
      .set(auth(tokenA)).send({ message: 'I love spicy food in Lagos' }).expect(200);
    const sid = created.body.session_id;
    expect(sid).toMatch(/^[0-9a-f-]{36}$/i);
    const denied = await request(app).post('/agent')
      .set(auth(tokenB)).send({ message: 'hello', session_id: sid }).expect(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
  });

  it('owner reusing their session gets 200', async () => {
    const created = await request(app).post('/agent')
      .set(auth(tokenA)).send({ message: 'budget mid range' }).expect(200);
    const again = await request(app).post('/agent')
      .set(auth(tokenA)).send({ message: 'still here', session_id: created.body.session_id }).expect(200);
    expect(again.body.message).toBe('mocked reply');
  });

  it('an anonymous read of a user-owned session is 404 (ownership enforced)', async () => {
    // Regression for the independent review's D-1: reading somebody else's
    // session used to return 200. A signed-in session now requires the
    // owning user's token.
    const created = await request(app).post('/agent')
      .set(auth(tokenA)).send({ message: 'seafood in Port Harcourt' }).expect(200);
    await request(app).get(`/chat/${created.body.session_id}`).set(auth(tokenB)).expect(404);
    await request(app).get(`/chat/${created.body.session_id}`).set(auth(tokenA)).expect(200);
  });
});