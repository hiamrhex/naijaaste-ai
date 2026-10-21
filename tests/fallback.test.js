import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// The agent's model call always fails in this file: the fallback must answer
// from the catalogue alone.
vi.mock('../src/agent/agent.js', () => ({
  runAgent: async () => {
    const err = new Error('LLM budget exhausted after 25000ms');
    err.code = 'LLM_TIMEOUT';
    err.timeoutMs = 25000;
    throw err;
  },
}));

import { app } from '../src/app.js';
import { deterministicAgentReply, extractHints } from '../src/services/fallback.service.js';

const signup = async (email) => {
  const res = await request(app)
    .post('/auth/signup')
    .send({ name: 'Fallback Probe', email, password: 'Str0ng!Passw0rd' });
  return res.body.accessToken;
};

describe('deterministic fallback when the model fails', () => {
  it('extracts city/budget/spice hints from the user message without a model', () => {
    const hints = extractHints('I need cheap jollof in Lagos, very spicy');
    expect(hints.city).toBe('Lagos');
    expect(hints.budget_level).toBe('budget');
    expect(hints.spice_tolerance).toBe('hot');
  });

  it('produces real catalogue picks for a city-scoped request', async () => {
    const reply = await deterministicAgentReply(
      { extracted_persona: {} },
      'Where can I eat jollof rice in Lagos?',
      'LLM_TIMEOUT',
    );
    expect(reply).toBeTruthy();
    expect(reply.picks.length).toBeGreaterThan(0);
    for (const pick of reply.picks) {
      expect(typeof pick.restaurant_name).toBe('string');
      expect(pick.restaurant_name.length).toBeGreaterThan(0);
    }
    expect(reply.text).toMatch(/catalogue/i);
  });

  it('POST /agent answers 200 with deterministic picks instead of an error page', async () => {
    const token = await signup(`fallback${Date.now()}@example.com`);
    const res = await request(app)
      .post('/agent')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Where can I eat jollof rice in Lagos?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta.fallback).toBe(true);
    expect(res.body.meta.fallback_reason).toBe('LLM_TIMEOUT');
    expect(res.body.message).toMatch(/catalogue/i);
    expect(res.body.recommendations.recommendations.length).toBeGreaterThan(0);
    expect(res.body.trace[0].tool).toBe('deterministic_fallback');
  });

  it('POST /agent still returns a typed JSON error when even the fallback has nothing', async () => {
    // A message with no city and no dish the catalogue knows: the fallback
    // cannot answer, so the contract is 504 AI_TIMEOUT + request id.
    const token = await signup(`fallback2${Date.now()}@example.com`);
    const res = await request(app)
      .post('/agent')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'zzzz qqqq' });

    expect(res.status).toBe(504);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AI_TIMEOUT');
    expect(res.body.requestId).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });
});
