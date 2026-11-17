import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

// /metrics used to accept any authenticated account. It now accepts either an
// admin session or a dedicated scrape token, compared in constant time. The env
// is set before the module graph loads because src/env.js parses once.

const ADMIN_EMAIL = 'metrics-admin@example.com';
const SCRAPE_TOKEN = 'scrape-token-0123456789abcdef';

import { verifiedToken } from './helpers/session.js';

vi.hoisted(() => {
  process.env.ADMIN_EMAILS = 'metrics-admin@example.com';
  process.env.METRICS_TOKEN = 'scrape-token-0123456789abcdef';
});

const { app } = await import('../src/app.js');

let adminToken = '';
let userToken = '';

beforeAll(async () => {
  adminToken = await verifiedToken(app, ADMIN_EMAIL, { name: 'Metrics Admin' });
  userToken = await verifiedToken(app, `metrics-user-${Date.now()}@example.com`, { name: 'Metrics User' });
});

describe('GET /metrics access', () => {
  it('rejects anonymous callers', async () => {
    await request(app).get('/metrics').expect(401);
  });

  it('accepts the scrape token', async () => {
    const res = await request(app)
      .get('/metrics')
      .set('Authorization', `Bearer ${SCRAPE_TOKEN}`)
      .expect(200);
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    expect(res.text).toContain('# HELP llm_calls_total');
  });

  it('rejects a wrong token of the same length', async () => {
    const wrong = 'x'.repeat(SCRAPE_TOKEN.length);
    await request(app).get('/metrics').set('Authorization', `Bearer ${wrong}`).expect(401);
  });

  it('accepts an admin session', async () => {
    const res = await request(app)
      .get('/metrics')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.text).toContain('http_requests_total');
  });

  it('rejects a regular user session', async () => {
    const res = await request(app)
      .get('/metrics')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
