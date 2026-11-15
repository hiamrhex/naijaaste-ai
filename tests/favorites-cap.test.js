import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { getPool } from '../src/db/pool.js';

// The favourites cap must hold at 50. The concurrent proof lives in
// tests/favorites-lock.test.js: the test database (pg-mem) ignores FOR UPDATE,
// so a parallel-add test here would measure the engine, not our code.

const unique = Date.now();
const CREDS = { name: 'Favourites User', email: `fav-${unique}@example.com`, password: 'supersecret123' };

let token = '';
let userId = '';

const auth = (req) => req.set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  const res = await request(app).post('/auth/signup').send(CREDS).expect(201);
  token = res.body.accessToken;
  userId = res.body.user.id;
});

describe('favourites cap', () => {
  it('accepts the 50th favourite and rejects the 51st', async () => {
    const pool = await getPool();
    const { rows } = await pool.query(
      'SELECT code FROM restaurants WHERE code IS NOT NULL ORDER BY code LIMIT 51'
    );
    expect(rows).toHaveLength(51);

    for (const row of rows.slice(0, 50)) {
      await pool.query(
        'INSERT INTO favorites (user_id, restaurant_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, row.code]
      );
    }

    const full = await auth(request(app).get('/auth/favorites')).expect(200);
    expect(full.body.favorites).toHaveLength(50);

    const rejected = await auth(request(app).post('/auth/favorites')).send({ restaurant_id: rows[50].code });
    expect(rejected.status).toBe(409);
    expect(rejected.body.error.code).toBe('FAVORITES_FULL');
  });
});
