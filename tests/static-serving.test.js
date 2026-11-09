import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

let app;

beforeAll(async () => {
  ({ app } = await import('../src/app.js'));
});

describe('static asset serving', () => {
  it('serves the service worker from public/ alongside the built app', async () => {
    const res = await request(app).get('/sw.js');
    expect(res.status).toBe(200);
  });

  it('serves the offline page and landing assets from public/', async () => {
    const offline = await request(app).get('/offline.html');
    expect(offline.status).toBe(200);

    const landing = await request(app).get('/landing.css');
    expect(landing.status).toBe(200);
  });

  it('still answers API 404s for unknown routes', async () => {
    const res = await request(app).get('/definitely-not-a-real-route');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
