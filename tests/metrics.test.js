import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import {
  recordRequest,
  recordLlmCall,
  recordLlmFailure,
  renderMetrics,
  resetMetrics,
} from '../src/lib/metrics.js';

describe('metrics rendering', () => {
  beforeEach(() => resetMetrics());

  it('renders cumulative histogram buckets and request counters', () => {
    recordRequest('GET', 200, 42);
    recordRequest('POST', 429, 1200);

    const text = renderMetrics();
    expect(text).toContain('http_requests_total{method="GET",status="200"} 1');
    expect(text).toContain('http_requests_total{method="POST",status="429"} 1');
    // Buckets must be cumulative, as the Prometheus exposition format requires.
    expect(text).toContain('http_request_duration_ms_bucket{le="50"} 1');
    expect(text).toContain('http_request_duration_ms_bucket{le="2500"} 2');
    expect(text).toContain('http_request_duration_ms_bucket{le="+Inf"} 2');
    expect(text).toContain('http_request_duration_ms_sum 1242');
    expect(text).toContain('http_request_duration_ms_count 2');
  });

  it('escapes label values so a model name cannot break the format', () => {
    recordLlmCall('model"with\\quotes');
    recordLlmFailure('BAD\nCODE');

    const text = renderMetrics();
    expect(text).toContain('llm_calls_total{model="model\\"with\\\\quotes"} 1');
    expect(text).toContain('llm_call_failures_total{code="BAD\\nCODE"} 1');
  });
});

describe('GET /metrics', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app).post('/auth/signup').send({
      name: 'Metrics User',
      email: `metrics${Date.now()}@example.com`,
      password: 'Str0ng!Passw0rd',
    });
    token = res.body.accessToken;
  });

  beforeEach(() => resetMetrics());

  it('requires authentication', async () => {
    const res = await request(app).get('/metrics').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('serves counters recorded from real requests, not fixtures', async () => {
    await request(app).get('/health').expect(200);

    const res = await request(app)
      .get('/metrics')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    expect(res.text).toContain('http_requests_total{method="GET",status="200"}');
    expect(res.text).toContain('http_request_duration_ms_count');
    // The previous implementation returned hardcoded sample data.
    expect(res.text).toContain('# HELP llm_calls_total Successful LLM responses by model (per instance).');
    expect(res.text).not.toContain('gemini-3.5-flash-lite"} 156');
  });
});
