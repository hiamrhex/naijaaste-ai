import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { verifiedToken } from './helpers/session.js';
import { app } from '../src/app.js';

// Every rejection must use the canonical failure envelope, including the
// middleware and the hand-rolled validation guards. These used to answer with
// `{ success:false, error:{...} }` and no requestId, so auth and geo failures
// were the only errors that could not be joined to a server log line.

const hasRequestId = (body) =>
  typeof body?.error?.requestId === 'string' && body.error.requestId.length >= 8;

describe('failure envelope consistency', () => {
  let token;

  beforeAll(async () => {
    token = await verifiedToken(app, `envelope${Date.now()}@example.com`, { name: 'Envelope User' });
  });

  it('requireAuth 401 carries requestId and no legacy success flag', async () => {
    const res = await request(app).get('/auth/me').expect(401);
    expect(res.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
        requestId: expect.any(String),
      },
    });
    expect(hasRequestId(res.body)).toBe(true);
  });

  it('invalid token 401 carries requestId', async () => {
    const res = await request(app).get('/auth/me').set('Authorization', 'Bearer nope').expect(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
    expect(hasRequestId(res.body)).toBe(true);
  });

  it('requireAdmin 403 carries requestId', async () => {
    const res = await request(app).get('/admin/stats').set('Authorization', `Bearer ${token}`).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(hasRequestId(res.body)).toBe(true);
  });

  it('GET /nearby invalid coordinates carry requestId', async () => {
    const res = await request(app).get('/nearby?lat=999&lng=0').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(hasRequestId(res.body)).toBe(true);
  });

  it('GET /restaurants/geo without ids carries requestId', async () => {
    const res = await request(app).get('/restaurants/geo').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(hasRequestId(res.body)).toBe(true);
  });
});
