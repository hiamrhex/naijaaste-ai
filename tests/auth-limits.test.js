import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

// The auth limiters get their own budget so this file can prove the 429
// contract without the rest of the suite tripping over it.
const PREV = {
  AUTH_RATE_LIMIT_SIGNUP_MAX: process.env.AUTH_RATE_LIMIT_SIGNUP_MAX,
  AUTH_RATE_LIMIT_FORGOT_MAX: process.env.AUTH_RATE_LIMIT_FORGOT_MAX,
};

let app;

beforeAll(async () => {
  process.env.AUTH_RATE_LIMIT_SIGNUP_MAX = '3';
  process.env.AUTH_RATE_LIMIT_FORGOT_MAX = '2';
  ({ app } = await import('../src/app.js'));
});

afterAll(() => {
  for (const [k, v] of Object.entries(PREV)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('auth rate limiting', () => {
  it('throttles signup and answers with the shared error contract', async () => {
    const mail = `lim${Date.now()}@example.com`;
    await request(app).post('/auth/signup').send({ name: 'Lim', email: mail, password: 'Str0ng!Passw0rd' }).expect(201);
    await request(app).post('/auth/signup').send({ name: 'Lim', email: `${mail}b`, password: 'Str0ng!Passw0rd' }).expect(201);
    await request(app).post('/auth/signup').send({ name: 'Lim', email: `${mail}c`, password: 'Str0ng!Passw0rd' }).expect(201);

    const res = await request(app)
      .post('/auth/signup')
      .send({ name: 'Lim', email: `${mail}d`, password: 'Str0ng!Passw0rd' })
      .expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.body.error.requestId).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(res.headers['retry-after']).toBeDefined();
    expect(res.headers['ratelimit']).toBeDefined();
  });

  it('throttles reset-code requests separately', async () => {
    // No signup needed: the limiter counts the request, known account or not.
    const mail = `limforgot${Date.now()}@example.com`;
    await request(app).post('/auth/forgot-password').send({ email: mail }).expect(200);
    await request(app).post('/auth/forgot-password').send({ email: mail }).expect(200);
    const res = await request(app).post('/auth/forgot-password').send({ email: mail }).expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.headers['retry-after']).toBeDefined();
  });
});
