import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Regression: the route mapped every success:false result to
// 404 NO_MATCHES, including an exhausted monthly quota. Clients were told a
// retryable backpressure condition was a permanent empty result.

const mocks = vi.hoisted(() => ({ getRecommendations: vi.fn() }));

vi.mock('../src/services/recommend.service.js', () => ({
  getRecommendations: mocks.getRecommendations,
}));

const { app } = await import('../src/app.js');

const persona = {
  persona_id: 'route-quota',
  city: 'Lagos',
  budget_level: 'mid_range',
  spice_tolerance: 'hot',
  ambience_preference: 'casual_dining',
  preferred_cuisines: ['Street Food'],
  dietary_flags: [],
};

describe('POST /recommend quota response', () => {
  beforeEach(() => {
    mocks.getRecommendations.mockReset();
  });

  it('maps quota exhaustion to 429 with a Retry-After header', async () => {
    mocks.getRecommendations.mockResolvedValueOnce({
      success: false,
      error: 'Monthly LLM quota exceeded (100 calls/month). Resets at month end.',
      code: 'LLM_QUOTA_EXCEEDED',
      status: 429,
      retryAfterSec: 1234,
    });

    const res = await request(app).post('/recommend').send({ persona }).expect(429);
    expect(res.body.error.code).toBe('LLM_QUOTA_EXCEEDED');
    expect(res.headers['retry-after']).toBe('1234');
    expect(res.body.error.requestId).toBeDefined();
  });

  it('still maps a genuine zero-match result to 404 NO_MATCHES', async () => {
    mocks.getRecommendations.mockResolvedValueOnce({
      success: false,
      error: 'No restaurants match persona constraints',
    });

    const res = await request(app).post('/recommend').send({ persona }).expect(404);
    expect(res.body.error.code).toBe('NO_MATCHES');
  });
});
