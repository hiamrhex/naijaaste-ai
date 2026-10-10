import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

const unique = Date.now();
const CREDS = {
  name: 'Reset Tester',
  email: `reset-${unique}@example.com`,
  password: 'original-password-1',
};

let accessToken = '';
let resetEmail = '';

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-0123456789abcdef';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-fedcba9876543210';
});

describe('Password reset flow (OTP)', () => {
  it('POST /auth/signup sets up the account', async () => {
    const res = await request(app).post('/auth/signup').send(CREDS).expect(201);
    accessToken = res.body.accessToken;
    resetEmail = res.body.user.email;
  });

  it('POST /auth/forgot-password rejects invalid email with 400', async () => {
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'not-an-email' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /auth/forgot-password returns generic success for unknown email (no enumeration)', async () => {
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: `nobody-${unique}@example.com` })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body).not.toHaveProperty('dev_otp');
  });

  it('POST /auth/forgot-password issues an OTP for a known account (dev_otp in test env)', async () => {
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: resetEmail })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.dev_otp).toMatch(/^\d{6}$/);
    globalThis.__resetOtp = res.body.dev_otp;
  });

  it('POST /auth/forgot-password rate-limits rapid resend with 429 cooldown', async () => {
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: resetEmail })
      .expect(429);
    expect(res.body.error.code).toBe('RESEND_COOLDOWN');
  });

  it('POST /auth/reset-password rejects bad format with 400', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ email: resetEmail, otp: '12', new_password: 'short' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /auth/reset-password rejects wrong OTP with 400', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ email: resetEmail, otp: '000000', new_password: 'brand-new-password-2' })
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_OTP');
  });

  it('POST /auth/reset-password accepts correct OTP and updates password', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ email: resetEmail, otp: globalThis.__resetOtp, new_password: 'brand-new-password-2' })
      .expect(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /auth/signin rejects OLD password after reset', async () => {
    const res = await request(app)
      .post('/auth/signin')
      .send({ email: resetEmail, password: CREDS.password })
      .expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('POST /auth/signin accepts NEW password after reset', async () => {
    const res = await request(app)
      .post('/auth/signin')
      .send({ email: resetEmail, password: 'brand-new-password-2' })
      .expect(200);
    expect(res.body.success).toBe(true);
    accessToken = res.body.accessToken;
  });

  it('Reused OTP is rejected after successful reset', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ email: resetEmail, otp: globalThis.__resetOtp, new_password: 'another-password-3' })
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_OTP');
  });
});

describe('Nearby endpoint', () => {
  it('GET /nearby rejects missing coordinates with 400', async () => {
    const res = await request(app).get('/nearby').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /nearby rejects out-of-range coordinates with 400', async () => {
    const res = await request(app).get('/nearby?lat=999&lng=0').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /nearby returns distance-sorted results around Lagos', async () => {
    const res = await request(app)
      .get('/nearby?lat=6.5095&lng=3.3711&limit=5')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.results.length).toBeGreaterThan(0);
    expect(res.body.results.length).toBeLessThanOrEqual(5);
    const distances = res.body.results.map((r) => r.distance_km);
    const sorted = [...distances].sort((a, b) => a - b);
    expect(distances).toEqual(sorted);
    expect(res.body.results[0].distance_km).toBeLessThan(5); // Yaba centroid ≈ origin
    expect(res.body.results[0].directions_url).toContain('google.com/maps/dir');
    expect(res.body.results[0]).toHaveProperty('lat');
    expect(res.body.results[0]).toHaveProperty('lng');
  });

  it('GET /nearby respects radius_km', async () => {
    const res = await request(app)
      .get('/nearby?lat=6.5095&lng=3.3711&radius_km=1')
      .expect(200);
    for (const r of res.body.results) {
      expect(r.distance_km).toBeLessThanOrEqual(1);
    }
  });
});

describe('Favorites endpoints', () => {
  it('GET /auth/favorites requires auth with 401', async () => {
    const res = await request(app).get('/auth/favorites').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('POST /auth/favorites adds a restaurant', async () => {
    const res = await request(app)
      .post('/auth/favorites')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ restaurant_id: 'r001' })
      .expect(201);
    expect(res.body.success).toBe(true);
    expect(res.body.favorites).toContain('r001');
  });

  it('POST /auth/favorites is idempotent (200 on repeat)', async () => {
    const res = await request(app)
      .post('/auth/favorites')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ restaurant_id: 'r001' })
      .expect(200);
    expect(res.body.added).toBe(false);
  });

  it('POST /auth/favorites rejects unknown restaurant with 404', async () => {
    const res = await request(app)
      .post('/auth/favorites')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ restaurant_id: 'r999' })
      .expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('POST /auth/favorites rejects missing id with 400', async () => {
    const res = await request(app)
      .post('/auth/favorites')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /auth/favorites returns enriched items', async () => {
    const res = await request(app)
      .get('/auth/favorites')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.favorites).toContain('r001');
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.items[0]).toHaveProperty('name');
    expect(res.body.items[0]).toHaveProperty('lat');
  });

  it('DELETE /auth/favorites/:id removes a restaurant', async () => {
    const res = await request(app)
      .delete('/auth/favorites/r001')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.removed).toBe(true);
    expect(res.body.favorites).not.toContain('r001');
  });
});
