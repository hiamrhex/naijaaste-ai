import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

// RED cycle 1 — Memory-first save-anything seam:
// POST /auth/saved-places with a name NOT in catalogue must NOT 404 (unlike favorites).
// Expected from grill Q3: user-scoped row, nullable price/hours, status unverified.

const unique = Date.now();
const CREDS = {
  name: 'Save Test',
  email: `saved-${unique}@example.com`,
  password: 'supersecret123',
};

let token = '';

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-0123456789abcdef';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-fedcba9876543210';
  const res = await request(app).post('/auth/signup').send(CREDS).expect(201);
  token = res.body.accessToken;
});

describe('saved_places save-anything (RED)', () => {
  it('saves an unknown spot by name without rejecting — 201 with unverified status and null price/hours', async () => {
    const res = await request(app)
      .post('/auth/saved-places')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Buka Queen Yaba — IG find' })
      .expect(201);

    // behavior spec from grill: never reject, never invent catalogue row
    expect(res.body.success).toBe(true);
    expect(typeof res.body.place.id).toBe('string');
    expect(res.body.place.name).toBe('Buka Queen Yaba — IG find');
    expect(res.body.place.status).toBe('unverified');
    expect(res.body.place.price_per_head_ngn).toBe(null);
    expect(res.body.place.price_source).toBe('unknown');
    expect(res.body.place.hours).toBe(null);
  });
});
