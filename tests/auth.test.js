import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

const unique = Date.now();
const CREDS = {
  name: 'Test User',
  email: `elite-${unique}@example.com`,
  password: 'supersecret123',
};

let accessToken = '';
let refreshCookie = '';

beforeAll(() => {
  // Ensure JWT secrets exist even if .env is missing keys
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-0123456789abcdef';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-fedcba9876543210';
});

describe('Auth system', () => {
  it('POST /auth/signup creates account and returns access token', async () => {
    const res = await request(app).post('/auth/signup').send(CREDS).expect(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe(CREDS.email);
    expect(res.body.user).not.toHaveProperty('password_hash');
    expect(typeof res.body.accessToken).toBe('string');
    accessToken = res.body.accessToken;
    const setCookie = res.headers['set-cookie'] || [];
    refreshCookie = setCookie.find((c) => c.startsWith('refreshToken=')) || '';
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('Path=/auth');
  });

  it('POST /auth/signup rejects duplicate email with 409', async () => {
    const res = await request(app).post('/auth/signup').send(CREDS).expect(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('POST /auth/signup rejects weak password with 400', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ name: 'X', email: 'weak@example.com', password: 'short' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /auth/signin returns token for correct credentials', async () => {
    const res = await request(app)
      .post('/auth/signin')
      .send({ email: CREDS.email, password: CREDS.password })
      .expect(200);
    expect(res.body.success).toBe(true);
    accessToken = res.body.accessToken;
  });

  it('POST /auth/signin rejects wrong password with 401', async () => {
    const res = await request(app)
      .post('/auth/signin')
      .send({ email: CREDS.email, password: 'wrong-password' })
      .expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('GET /auth/me returns user with valid token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.user.email).toBe(CREDS.email);
  });

  it('GET /auth/me rejects missing token with 401', async () => {
    const res = await request(app).get('/auth/me').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('GET /auth/me rejects garbage token with 401', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer not.a.real.token')
      .expect(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('POST /auth/refresh rotates token when cookie present', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(200);
    expect(typeof res.body.accessToken).toBe('string');
    const setCookie = res.headers['set-cookie'] || [];
    const rotated = setCookie.find((c) => c.startsWith('refreshToken='));
    expect(rotated).toBeTruthy();
    expect(rotated).not.toBe(refreshCookie);
    refreshCookie = rotated;
    accessToken = res.body.accessToken;
  });

  it('POST /auth/refresh rejects missing cookie with 401', async () => {
    const res = await request(app).post('/auth/refresh').expect(401);
    expect(res.body.error.code).toBe('NO_REFRESH_TOKEN');
  });

  it('POST /agent rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post('/agent')
      .send({ message: 'hello' })
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('POST /agent rejects empty message with 400 when authenticated', async () => {
    const res = await request(app)
      .post('/agent')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /auth/signout clears the refresh cookie', async () => {
    const res = await request(app)
      .post('/auth/signout')
      .set('Cookie', refreshCookie)
      .expect(200);
    expect(res.body.success).toBe(true);
    const setCookie = res.headers['set-cookie'] || [];
    const cleared = setCookie.find((c) => c.startsWith('refreshToken=;'));
    expect(cleared || setCookie.join(';')).toContain('refreshToken=');
  });
});
