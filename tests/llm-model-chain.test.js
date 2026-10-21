import { describe, it, expect, vi, afterEach } from 'vitest';

const state = vi.hoisted(() => ({ calls: [], behaviour: null }));

// The SDK is mocked at module level: llm.service builds its client at import.
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    constructor() {
      this.models = {
        generateContent: async (req) => {
          state.calls.push(req.model);
          if (!state.behaviour) throw new Error('no behaviour configured');
          return state.behaviour(req);
        },
      };
    }
  },
}));

afterEach(() => {
  state.calls = [];
  state.behaviour = null;
  vi.resetModules();
});

describe('Gemini model chain', () => {
  it('falls back to the next model when the configured model is unavailable', async () => {
    const { callLLMJson, MODEL_CHAIN } = await import('../src/services/llm.service.js');
    expect(MODEL_CHAIN.length).toBeGreaterThan(1);

    const [primary, secondary] = MODEL_CHAIN;
    state.behaviour = async (req) => {
      if (req.model === primary) {
        const err = new Error('model overloaded');
        err.status = 503;
        throw err;
      }
      return { text: '{"ok":true}', candidates: [{ finishReason: 'STOP' }] };
    };

    const data = await callLLMJson('hello');
    expect(data).toEqual({ ok: true });
    expect(state.calls[0]).toBe(primary);
    expect(state.calls).toContain(secondary);
  });

  it('marks a failing model degraded so later calls skip it', async () => {
    const { callLLMJson, MODEL_CHAIN } = await import('../src/services/llm.service.js');
    const [primary, secondary] = MODEL_CHAIN;
    state.behaviour = async (req) => {
      if (req.model === primary) {
        const err = new Error('model overloaded');
        err.status = 503;
        throw err;
      }
      return { text: '{"ok":true}', candidates: [{ finishReason: 'STOP' }] };
    };

    await callLLMJson('first');
    state.calls = [];
    await callLLMJson('second');

    // The broken model is skipped on the next call.
    expect(state.calls).not.toContain(primary);
    expect(state.calls[0]).toBe(secondary);
  });

  it('surfaces AI_UNAVAILABLE (not a timeout) when every model fails', async () => {
    const { callLLMJson } = await import('../src/services/llm.service.js');
    state.behaviour = async () => {
      const err = new Error('nope');
      err.status = 503;
      throw err;
    };

    await expect(callLLMJson('hello')).rejects.toMatchObject({
      code: 'LLM_UNAVAILABLE',
      status: 503,
    });
  });

  it('surfaces LLM_TIMEOUT when the budget runs out mid-chain', async () => {
    process.env.GEMINI_TOTAL_TIMEOUT_MS = '150';
    process.env.GEMINI_ATTEMPT_TIMEOUT_MS = '150';

    const { callLLMJson } = await import('../src/services/llm.service.js');
    state.behaviour = () => new Promise(() => { /* never settles */ });

    await expect(callLLMJson('hello')).rejects.toMatchObject({ code: 'LLM_TIMEOUT' });
  });
});
