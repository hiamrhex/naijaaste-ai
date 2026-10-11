import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('POST /auth/google', () => {
  it('rejects a missing credential with 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/auth/google').send({}).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a non-string credential with 400', async () => {
    await request(app).post('/auth/google').send({ credential: 42 }).expect(400);
  });

  it('returns 503 GOOGLE_NOT_CONFIGURED when no GOOGLE_CLIENT_ID is set (test env)', async () => {
    const res = await request(app)
      .post('/auth/google')
      .send({ credential: 'eyJhbGciOiJSUzI1NiJ9.fake.fake' })
      .expect(503);
    expect(res.body.error.code).toBe('GOOGLE_NOT_CONFIGURED');
  });

  it('advertises google_auth:false in /health when unconfigured', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.features.google_auth).toBe(false);
  });
});
