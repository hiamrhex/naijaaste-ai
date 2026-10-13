import { describe, it, expect } from 'vitest';
import request from 'supertest';
import handler from '../api/index.js';

// The Vercel entry strips the /api mount prefix back to served paths.
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
});
