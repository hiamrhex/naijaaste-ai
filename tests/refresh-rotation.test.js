import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

// Refresh rotation used to be check-then-act: hasRefreshToken() followed by
// revokeRefreshToken(). Two requests carrying the same cookie (two tabs, or a
// replay) could both pass the check before either revoked, minting two
// independent token families from one token.

const unique = Date.now();
const CREDS = {
  name: 'Rotation User',
  email: `rotation-${unique}@example.com`,
  password: 'supersecret123',
};

const refreshCookie = (res) =>
  (res.headers['set-cookie'] || []).find((c) => c.startsWith('refreshToken='));

describe('refresh token rotation', () => {
  it('lets exactly one of two concurrent refreshes succeed', async () => {
    const signup = await request(app).post('/auth/signup').send(CREDS).expect(201);
    const cookie = refreshCookie(signup);
    expect(cookie).toBeTruthy();

    const [first, second] = await Promise.all([
      request(app).post('/auth/refresh').set('Cookie', cookie),
      request(app).post('/auth/refresh').set('Cookie', cookie),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 401]);

    const rejected = first.status === 401 ? first : second;
    expect(rejected.body.error.code).toBe('INVALID_REFRESH');
  });

  it('rejects a replay of an already-rotated cookie', async () => {
    const creds = { ...CREDS, email: `replay-${unique}@example.com` };
    const signup = await request(app).post('/auth/signup').send(creds).expect(201);
    const cookie = refreshCookie(signup);

    await request(app).post('/auth/refresh').set('Cookie', cookie).expect(200);
    const replay = await request(app).post('/auth/refresh').set('Cookie', cookie).expect(401);
    expect(replay.body.error.code).toBe('INVALID_REFRESH');
  });
});
