import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

const PREV = {
  RATE_LIMIT_API_MAX: process.env.RATE_LIMIT_API_MAX,
  RATE_LIMIT_LLM_MAX: process.env.RATE_LIMIT_LLM_MAX,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
};

let app;
let token;

beforeAll(async () => {
  process.env.RATE_LIMIT_API_MAX = '3';
  process.env.RATE_LIMIT_LLM_MAX = '10';
  process.env.CORS_ORIGIN = 'https://allowed.example';
  ({ app } = await import('../src/app.js'));
  const res = await request(app).post('/auth/signup').send({
    name: 'Test User',
    email: `test${Date.now()}@example.com`,
    password: 'Str0ng!Passw0rd',
  });
  token = res.body.accessToken;
});

afterAll(() => {
  for (const [k, v] of Object.entries(PREV)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('rate limiting (layer 1)', () => {
  it('never throttles /health (probes exempt)', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).get('/health').expect(200);
    }
  });

  it('throttles general routes after RATE_LIMIT_API_MAX requests with a contract 429', async () => {
    // GET /chat/:id (no LLM): 3 pass (404), 4th → 429
    await request(app).get('/chat/11111111-1111-4111-8111-111111111111').set(auth()).expect(404);
    await request(app).get('/chat/11111111-1111-4111-8111-111111111111').set(auth()).expect(404);
    await request(app).get('/chat/11111111-1111-4111-8111-111111111111').set(auth()).expect(404);
    const res = await request(app)
      .get('/chat/11111111-1111-4111-8111-111111111111')
      .set(auth())
      .expect(429);
    expect(res.body).not.toHaveProperty('success');
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.body.error.requestId).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(res.headers['retry-after']).toBeDefined();
    // draft-7 sends the combined `ratelimit` header
    expect(res.headers['ratelimit']).toBeDefined();
  });
});

describe('CORS allowlist (production config)', () => {
  it('reflects only allowed origins', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://allowed.example')
      .expect(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://allowed.example');
  });

  it('does not grant CORS to disallowed origins', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://evil.example')
      .expect(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});