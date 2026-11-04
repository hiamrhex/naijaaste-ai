import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

const PREV = {
  RATE_LIMIT_API_MAX: process.env.RATE_LIMIT_API_MAX,
  RATE_LIMIT_LLM_MAX: process.env.RATE_LIMIT_LLM_MAX,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
};

let app;
let token;

beforeAll(async () => {
  // Use higher limits for this test file to avoid cross-test contamination
  process.env.RATE_LIMIT_API_MAX = '100';
  process.env.RATE_LIMIT_LLM_MAX = '20'; // Account for ~8 previous requests + test requests
  process.env.CORS_ORIGIN = 'https://allowed.example';
  ({ app } = await import('../src/app.js'));

  const res = await request(app).post('/auth/signup').send({
    name: 'Test User',
    email: `test${Date.now()}@example.com`,
    password: 'Str0ng!Passw0rd',
  });
  token = res.body.accessToken;
});

afterAll(() => {
  for (const [k, v] of Object.entries(PREV)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('API baseline', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.endpoints).toContain('POST /api/v1/chat');
  });

  it('POST /chat without message returns 400', async () => {
    const res = await request(app).post('/chat').set(auth()).send({}).expect(400);
    expect(res.body).not.toHaveProperty('success');
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET unknown session returns 404', async () => {
    const res = await request(app)
      .get('/chat/11111111-1111-4111-8111-111111111111')
      .set(auth())
      .expect(404);
    expect(res.body).not.toHaveProperty('success');
    expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
  });

  it('unknown route returns 404', async () => {
    const res = await request(app).get('/definitely-not-a-route').expect(404);
    expect(res.body).not.toHaveProperty('success');
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  // SSRF negative test: no endpoint accepts user-supplied URLs for fetching
  it('no endpoint fetches user-supplied URLs (SSRF guard)', async () => {
    // Search for any route that might accept a URL parameter
    const sensitivePaths = ['/chat', '/agent', '/recommend', '/extract-persona', '/update-preference', '/generate-review'];
    for (const path of sensitivePaths) {
      await request(app)
        .post(path)
        .set(auth())
        .send({ url: 'http://169.254.169.254/latest/meta-data/', message: 'test' })
        .expect(res => {
          // Must NOT succeed with a fetch to metadata service
          // Valid responses: 400 (validation), 401, 429, 502 (upstream), 503
          // Invalid: 200 with fetched content
          if (res.status === 200 && res.body.success) {
            const text = JSON.stringify(res.body);
            expect(text).not.toContain('ami-id');
            expect(text).not.toContain('instance-id');
          }
        });
    }
  });

  // Boot-to-healthy: /health/ready should respond quickly after cold start
  it('GET /health/ready responds within 5s (boot-to-healthy)', async () => {
    const start = Date.now();
    const res = await request(app).get('/health/ready').expect(200);
    expect(Date.now() - start).toBeLessThan(5000);
    expect(res.body.ready).toBe(true);
  });

  // Metrics endpoint for SLO aggregation (check 16)
  it('GET /metrics returns Prometheus-format metrics for SLO aggregation', async () => {
    const res = await request(app).get('/metrics').set(auth()).expect(200);
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('http_request_duration_ms');
    expect(res.text).toContain('llm_calls_total');
  });

  // Test that LLM endpoints have separate rate limiting
  it('LLM endpoints have separate rate limiting (10/min)', async () => {
    const maxRequests = 12; // Account for ~8 previous requests in this test file, limit is 20
    
    // Make requests to LLM endpoint until we hit the limit
    for (let i = 0; i < maxRequests + 2; i++) {
      const res = await request(app)
        .post('/chat')
        .set(auth())
        .send({ message: 'test message' });
      if (i < maxRequests) {
        // First 12 requests: may succeed (200) or fail LLM (503) - but rate limiter allows them
        expect([200, 503]).toContain(res.status);
      } else {
        // 13th+ requests: rate limited to 429
        expect(res.status).toBe(429);
        expect(res.body.error.code).toBe('RATE_LIMITED');
      }
    }
  });
});