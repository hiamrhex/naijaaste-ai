import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

// Plan 010: the LLM limiter must guard canonical /api/v1 paths, not just
// legacy ones. Per-file dynamic import isolates limiter counters.
const PREV = {
  RATE_LIMIT_API_MAX: process.env.RATE_LIMIT_API_MAX,
  RATE_LIMIT_LLM_MAX: process.env.RATE_LIMIT_LLM_MAX,
};

let app;

beforeAll(async () => {
  process.env.RATE_LIMIT_API_MAX = '100';
  process.env.RATE_LIMIT_LLM_MAX = '2';
  ({ app } = await import('../src/app.js'));
});

afterAll(() => {
  for (const [k, v] of Object.entries(PREV)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('LLM limiter on canonical mounts (plan 010)', () => {
  it('POST /api/v1/chat trips 429 after LLM_MAX (400s still count)', async () => {
    await request(app).post('/api/v1/chat').send({}).expect(400);
    await request(app).post('/api/v1/chat').send({}).expect(400);
    const res = await request(app).post('/api/v1/chat').send({}).expect(429);
    expect(res.body).not.toHaveProperty('success');
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.body.error.requestId).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('legacy POST /chat is under the same enforcement', async () => {
    // Whether the mounts share one counter or count per path, a third
    // consecutive LLM-path hit is over budget either way.
    await request(app).post('/chat').send({});
    await request(app).post('/chat').send({});
    const res = await request(app).post('/chat').send({});
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});
