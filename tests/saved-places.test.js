import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { MAX_SAVED } from '../src/saved_places/store.js';

// RED cycle 1 — Memory-first save-anything seam:
// POST /auth/saved-places with a name NOT in catalogue must NOT 404 (unlike favorites).
// Expected from grill Q3: user-scoped row, nullable price/hours, status unverified.

const unique = Date.now();
const CREDS = {
  name: 'Save Test',
  email: `saved-${unique}@example.com`,
  password: 'supersecret123',
};
const OTHER = {
  name: 'Other User',
  email: `other-${unique}@example.com`,
  password: 'supersecret123',
};

let token = '';
let otherToken = '';
let mineId = '';

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-0123456789abcdef';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-fedcba9876543210';
  const res = await request(app).post('/auth/signup').send(CREDS).expect(201);
  token = res.body.accessToken;
  const res2 = await request(app).post('/auth/signup').send(OTHER).expect(201);
  otherToken = res2.body.accessToken;
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

  it('GET lists only my saved spots with names — owner-scoped, no catalogue lookup', async () => {
    await request(app)
      .post('/auth/saved-places')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Terra Kulture TBS' })
      .expect(201);
    const res = await request(app)
      .get('/auth/saved-places')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    const names = res.body.places.map((p) => p.name);
    expect(names).toContain('Terra Kulture TBS');
    expect(names).toContain('Buka Queen Yaba — IG find');
    expect(res.body.places[0].status).toBe('unverified');
    expect(res.body.places[0].price_per_head_ngn).toBe(null);
    expect(res.body.places[0].price_source).toBe('unknown');
  });
});

describe('saved_places delete (owner-only)', () => {
  it('removes my own row — 200, gone from the list', async () => {
    const made = await request(app)
      .post('/auth/saved-places')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Doomsday Spot to delete' })
      .expect(201);
    mineId = made.body.place.id;
    await request(app)
      .delete(`/auth/saved-places/${mineId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const list = await request(app)
      .get('/auth/saved-places')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body.places.map((p) => p.id)).not.toContain(mineId);
  });

  it('another user’s id is a 404 — never deletes, never leaks existence', async () => {
    const made = await request(app)
      .post('/auth/saved-places')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Invisible to others' })
      .expect(201);
    await request(app)
      .delete(`/auth/saved-places/${made.body.place.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
    const list = await request(app)
      .get('/auth/saved-places')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body.places.map((p) => p.id)).toContain(made.body.place.id);
  });

  it('bogus id is a 404 too', async () => {
    await request(app)
      .delete('/auth/saved-places/not-even-a-uuid')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('anonymous delete is a 401', async () => {
    await request(app)
      .delete(`/auth/saved-places/${mineId}`)
      .expect(401);
  });
});

describe('saved_places 50-cap (DB-enforced, parallel bursts)', () => {
  it('a parallel burst of creates cannot exceed the cap', { timeout: 120_000 }, async () => {
    // Fill to exactly MAX_SAVED-1 synchronously.
    const capUser = {
      name: 'Cap Runner',
      email: `cap-${unique}@example.com`,
      password: 'supersecret123',
    };
    const signed = await request(app).post('/auth/signup').send(capUser).expect(201);
    const capToken = signed.body.accessToken;
    for (let i = 0; i < MAX_SAVED - 1; i++) {
      await request(app)
        .post('/auth/saved-places')
        .set('Authorization', `Bearer ${capToken}`)
        .send({ name: `Filler ${i}` })
        .expect(201);
    }
    // Now fire 8 IDENTICAL creates concurrently. At most one may land (cap 50
    // with 49 filled); the rest must get a clean 409, and the stored count
    // must end exactly at 50 — never over.
    const burst = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(app)
          .post('/auth/saved-places')
          .set('Authorization', `Bearer ${capToken}`)
          .send({ name: 'Burst winner' })
      )
    );
    const created = burst.filter((r) => r.status === 201);
    expect(created.length).toBe(1);
    for (const r of burst.filter((x) => x.status !== 201)) {
      expect(r.status).toBe(409);
      expect(r.body.error.code).toBe('SAVED_FULL');
    }
    const list = await request(app)
      .get('/auth/saved-places')
      .set('Authorization', `Bearer ${capToken}`)
      .expect(200);
    expect(list.body.places.length).toBe(MAX_SAVED);
    expect(list.body.places.length).toBeLessThanOrEqual(MAX_SAVED);
  });
});
