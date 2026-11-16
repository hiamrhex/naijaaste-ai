import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { getPool } from '../src/db/pool.js';

// Rows imported from OSM have osm_id set and code NULL. A favourite may be
// saved by either id (findRestaurantByCode accepts both), but the list lookup
// matched only `code`, so an OSM favourite appeared in `favorites` with no
// matching `items` entry and the saved screen had nothing to render.

const OSM_ID = `node/${Date.now()}`;

let token = '';

beforeAll(async () => {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO restaurants (osm_id, name, city, lat, lng)
     VALUES ($1, 'OSM-only Buka', 'Lagos', 6.5, 3.4)`,
    [OSM_ID]
  );

  const res = await request(app).post('/auth/signup').send({
    name: 'OSM Favourite User',
    email: `osm-fav-${Date.now()}@example.com`,
    password: 'supersecret123',
  }).expect(201);
  token = res.body.accessToken;
});

const auth = (req) => req.set('Authorization', `Bearer ${token}`);

describe('favourites by osm_id', () => {
  it('returns the item for a favourite saved by osm_id', async () => {
    await auth(request(app).post('/auth/favorites')).send({ restaurant_id: OSM_ID }).expect(201);

    const res = await auth(request(app).get('/auth/favorites')).expect(200);

    expect(res.body.favorites).toContain(OSM_ID);
    const item = res.body.items.find((i) => i.restaurant_id === OSM_ID);
    expect(item).toBeDefined();
    expect(item.name).toBe('OSM-only Buka');
  });
});
