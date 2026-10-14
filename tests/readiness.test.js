import { describe, it, expect, vi, beforeEach } from 'vitest';

let queryImpl = async () => ({ rows: [{ '?column?': 1 }] });
vi.mock('../src/db/pool.js', () => ({
  getPool: async () => ({ query: (...a) => queryImpl(...a) }),
  dbEnabled: () => true,
  closePool: async () => {},
}));

import request from 'supertest';
import { app } from '../src/app.js';

describe('/health (liveness) vs /health/ready (readiness) — item 7', () => {
  beforeEach(() => {
    queryImpl = async () => ({ rows: [{ '?column?': 1 }] });
  });

  it('liveness stays 200 without touching the DB', async () => {
    queryImpl = async () => { throw new Error('db must not be hit'); };
    const res = await request(app).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('readiness is 200 when SELECT 1 succeeds', async () => {
    const res = await request(app).get('/health/ready').expect(200);
    expect(res.body).toMatchObject({ ready: true, db: 'up' });
  });

  it('readiness is 503 with db:down when the query fails', async () => {
    queryImpl = async () => { throw new Error('ECONNREFUSED dead:5433'); };
    const res = await request(app).get('/health/ready').expect(503);
    expect(res.body).toMatchObject({ ready: false, db: 'down' });
  });

  it('readiness times out (no hang) when the query never answers', async () => {
    queryImpl = () => new Promise(() => {});
    const res = await request(app).get('/health/ready').expect(503);
    expect(res.body).toMatchObject({ ready: false, db: 'down' });
  });
});
