import { describe, it, expect, vi } from 'vitest';
import { createBreaker, llmBreaker } from '../src/services/llm.service.js';

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
