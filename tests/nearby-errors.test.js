import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

// Regression: a database failure inside these handlers was an async throw with
// no try/catch. Express 4 does not route async rejections to errorHandler, so
// a routine Neon socket reset became `unhandledRejection` (observed live) and
// the client saw no response. Both routes must answer a JSON 500 instead.

const dbDown = async () => {
  const err = new Error('read ECONNRESET');
  err.code = 'ECONNRESET';
  throw err;
};

vi.mock('../src/db/catalogue.js', () => ({
  mapRow: (row) => row,
  getCatalogue: vi.fn(dbDown),
  getCatalogueByCity: vi.fn(dbDown),
  getRestaurantsByCodes: vi.fn(dbDown),
  getRestaurantsInBox: vi.fn(dbDown),
  findRestaurantByCode: vi.fn(dbDown),
  findRestaurantsByName: vi.fn(dbDown),
}));

let app;

beforeAll(async () => {
  ({ app } = await import('../src/app.js'));
});

describe('nearby routes answer database failures as JSON 500', () => {
  it('GET /restaurants/geo', async () => {
    const res = await request(app)
      .get('/restaurants/geo?ids=r001,r002')
      .expect(500);

    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.error.code).toBe('INTERNAL');
    expect(res.body.error).toHaveProperty('requestId');
  });

  it('GET /nearby', async () => {
    const res = await request(app)
      .get('/nearby?lat=6.52&lng=3.38')
      .expect(500);

    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.error.code).toBe('INTERNAL');
  });
});
