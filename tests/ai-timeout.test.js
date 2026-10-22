import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import request from 'supertest';

afterEach(() => {
  vi.doUnmock('../src/services/llm.service.js');
  vi.resetModules();
});

const llmMock = (fn) => ({
  callLLMJson: fn,
  callLLM: fn,
  callPersonaLLM: fn,
  callReviewLLM: fn,
  callRecommendLLM: fn,
  // agent.js imports these at module load; unused on this path.
  LLM_TOTAL_TIMEOUT_MS: 25000,
  LLM_TIMEOUT_MS: 12000,
  LlmTimeoutError: class LlmTimeoutError extends Error {
    constructor() { super('timeout'); this.code = 'LLM_TIMEOUT'; }
  },
  withTimeout: (promise) => promise,
});

describe('Gemini budget (server)', () => {
  let token;

  beforeAll(async () => {
    const { app } = await import('../src/app.js');
    const res = await request(app).post('/auth/signup').send({
      name: 'Test User',
      email: `test${Date.now()}@example.com`,
      password: 'Str0ng!Passw0rd',
    });
    token = res.body.accessToken;
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('chat returns JSON 504 AI_TIMEOUT with a requestId when the model exceeds our budget', async () => {
    vi.resetModules();
    vi.doMock('../src/services/llm.service.js', () => llmMock(async () => {
      const err = new Error('LLM budget exhausted after 25000ms');
      err.code = 'LLM_TIMEOUT';
      err.timeoutMs = 25000;
      throw err;
    }));

    const { app } = await import('../src/app.js');
    const res = await request(app)
      .post('/api/v1/chat')
      .set(auth())
      .send({ message: 'Find me jollof rice in Lagos' });

    expect(res.status).toBe(504);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.error.code).toBe('AI_TIMEOUT');
    expect(res.body.error.requestId).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(res.headers['x-request-id']).toBe(res.body.error.requestId);
  });

  it('chat returns JSON 503 AI_UNAVAILABLE when the circuit is open', async () => {
    vi.resetModules();
    vi.doMock('../src/services/llm.service.js', () => llmMock(async () => {
      const err = new Error('LLM circuit is open');
      err.code = 'CIRCUIT_OPEN';
      throw err;
    }));

    const { app } = await import('../src/app.js');
    const res = await request(app)
      .post('/api/v1/chat')
      .set(auth())
      .send({ message: 'Find me jollof rice in Lagos' });

    expect(res.status).toBe(503);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.error.code).toBe('AI_UNAVAILABLE');
    expect(res.body.error.requestId).toBeTruthy();
  });

  it('the real caller aborts a hung Gemini request inside the total budget', async () => {
    process.env.GEMINI_TOTAL_TIMEOUT_MS = '120';
    process.env.GEMINI_ATTEMPT_TIMEOUT_MS = '120';

    vi.resetModules();
    vi.doMock('@google/genai', () => ({
      GoogleGenAI: class {
        models = { generateContent: () => new Promise(() => { /* never resolves */ }) };
      },
    }));

    const { callLLMJson, LLM_TOTAL_TIMEOUT_MS } = await import('../src/services/llm.service.js');
    expect(LLM_TOTAL_TIMEOUT_MS).toBeLessThanOrEqual(1000);

    const started = Date.now();
    await expect(callLLMJson('hello')).rejects.toMatchObject({ code: 'LLM_TIMEOUT' });
    expect(Date.now() - started).toBeLessThan(5000);
    vi.doUnmock('@google/genai');
  });
});