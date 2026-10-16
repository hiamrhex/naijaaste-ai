import { describe, it, expect, vi, afterEach } from 'vitest';
import { createBreaker, llmBreaker } from '../src/services/llm.service.js';

afterEach(() => {
  vi.restoreAllMocks();
});

// withTimeout lives inside the module closure; exercise it through a local
// copy of the contract is wrong — instead verify the exported constant and
// breaker behavior, plus the fallback path below.
describe('circuit breaker (item 6)', () => {
  it('starts closed and passes calls through', async () => {
    const b = createBreaker({ threshold: 3, coolDownMs: 1000 });
    expect(b.state).toBe('closed');
    expect(await b.exec(async () => 'ok')).toBe('ok');
    expect(b.failures).toBe(0);
  });

  it('opens after threshold failures and fails fast without calling fn', async () => {
    let now = 1000;
    const b = createBreaker({ threshold: 3, coolDownMs: 60000, now: () => now });
    const boom = async () => { throw new Error('down'); };
    await expect(b.exec(boom)).rejects.toThrow('down');
    await expect(b.exec(boom)).rejects.toThrow('down');
    await expect(b.exec(boom)).rejects.toThrow('down');
    expect(b.state).toBe('open');
    const spy = vi.fn(async () => 'never');
    await expect(b.exec(spy)).rejects.toMatchObject({ code: 'CIRCUIT_OPEN' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('half-opens after cooldown; success closes, failure reopens', async () => {
    let now = 0;
    const b = createBreaker({ threshold: 2, coolDownMs: 1000, now: () => now });
    const boom = async () => { throw new Error('down'); };
    await expect(b.exec(boom)).rejects.toThrow();
    await expect(b.exec(boom)).rejects.toThrow();
    expect(b.state).toBe('open');
    now = 1001;
    expect(b.state).toBe('half-open');
    expect(await b.exec(async () => 'recovered')).toBe('recovered');
    expect(b.state).toBe('closed');
    expect(b.failures).toBe(0);
  });

  it('a fresh probe failure in half-open state reopens immediately', async () => {
    let now = 0;
    const b = createBreaker({ threshold: 1, coolDownMs: 1000, now: () => now });
    await expect(b.exec(async () => { throw new Error('x'); })).rejects.toThrow();
    expect(b.state).toBe('open');
    now = 2000;
    await expect(b.exec(async () => { throw new Error('y'); })).rejects.toThrow('y');
    expect(b.state).toBe('open');
  });

  it('reset() restores closed state', async () => {
    const b = createBreaker({ threshold: 1, coolDownMs: 60000 });
    await expect(b.exec(async () => { throw new Error('x'); })).rejects.toThrow();
    expect(b.state).toBe('open');
    b.reset();
    expect(b.state).toBe('closed');
    expect(await b.exec(async () => 'ok')).toBe('ok');
  });

  it('the shared instance exposes the breaker contract', () => {
    expect(llmBreaker.state).toBe('closed');
    expect(typeof llmBreaker.exec).toBe('function');
    expect(typeof llmBreaker.reset).toBe('function');
  });
});

// Regression: a known upstream failure must surface as a clean 502, not a 500.
// Proven by breaking the live server earlier — CIRCUIT_OPEN reached Express as
// a generic 500 (logs 2026-10-15).
describe('chat maps upstream LLM failure to a clean 502', () => {
  it('processChat throws UpstreamError (502 UPSTREAM_FAILURE) when the circuit is open', async () => {
    vi.resetModules();
    vi.doMock('../src/services/llm.service.js', () => ({
      callLLMJson: async () => {
        const err = new Error('LLM circuit is open — upstream failing, request skipped');
        err.code = 'CIRCUIT_OPEN';
        throw err;
      },
    }));
    const { processChat } = await import('../src/services/chat.service.js');
    const { ApiError } = await import('../src/lib/errors.js');

    await expect(processChat('00000000-0000-4000-8000-000000000000', 'hi')).rejects.toMatchObject({
      status: 502,
      code: 'UPSTREAM_FAILURE',
    });
    await expect(processChat('00000000-0000-4000-8000-000000000000', 'hi')).rejects.toBeInstanceOf(ApiError);
    vi.doUnmock('../src/services/llm.service.js');
    vi.resetModules();
  });
});
