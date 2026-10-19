import { describe, it, expect } from 'vitest';
import request from 'supertest';
import handler from '../api/index.js';

// The Vercel entry maps two documented prefixes onto the routers:
//   /api/auth|… → strip to root picks (/auth|…)
//   /api/v1/…   → canonical base, kept for the /api/v1 mount to strip itself.
describe('serverless entry (api/index.js)', () => {
  it('POST /api/auth/signup reaches the auth router (201)', async () => {
    const res = await request(handler)
      .post('/api/auth/signup')
      .send({ name: 'Serverless', email: `sls${Date.now()}@example.com`, password: 'Str0ng!Passw0rd' })
      .expect(201);
    expect(res.body.user.email).toContain('@example.com');
  });

  it('GET /api/health stays reachable', async () => {
    const res = await request(handler).get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /api/v1/auth/signup reaches the auth router via the CANONICAL base (201)', async () => {
    const res = await request(handler)
      .post('/api/v1/auth/signup')
      .send({ name: 'Canonical', email: `canon${Date.now()}@example.com`, password: 'Str0ng!Passw0rd' })
      .expect(201);
    expect(res.body.user.email).toContain('@example.com');
  });

  it('GET /api/v1/auth/saved-places answers on the canonical base (401 when anonymous, not 404)', async () => {
    // Health is unversioned by design (src/app.js), so the canonical-versioned
    // route this probe exercises is an auth route: reachable => no 404.
    const res = await request(handler)
      .get('/api/v1/auth/saved-places')
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('both prefixes surfacing the same bug shape: saved-places reachable on both', async () => {
    // Regression: /api/v1/auth/saved-places previously returned 404 on Vercel.
    const light = await request(handler)
      .post('/api/auth/signup')
      .send({ name: 'Dual Path', email: `dual${Date.now()}@example.com`, password: 'Str0ng!Passw0rd' });
    const token = light.body?.accessToken;
    expect(token).toBeTruthy();
    const res1 = await request(handler)
      .post('/api/auth/saved-places')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'same' })
      .expect(201);
    const res2 = await request(handler)
      .post('/api/v1/auth/saved-places')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'same' })
      .expect(201);
    expect(res1.body.place.name).toBe(res2.body.place.name);
  });
});
