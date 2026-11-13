import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { resilientPool } from '../src/db/pool.js';

// The pool is only wrapped when DATABASE_URL points at a real Postgres, so
// these tests pin the contract against a fake pool: retry once on a dropped
// connection, destroy the dead socket, and never let a checked-out client's
// 'error' event escape as an uncaughtException.

const transient = (code = 'ECONNRESET') => Object.assign(new Error(code), { code });

class FakeClient extends EventEmitter {
  constructor(outcomes) {
    super();
    this.outcomes = outcomes;
    this.releases = [];
    this.queries = [];
  }

  async query(text, values) {
    this.queries.push([text, values]);
    const next = this.outcomes.shift();
    if (next instanceof Error) {
      // pg emits the connection error on the client as well as rejecting the
      // query. With no listener Node would kill the process here.
      this.emit('error', next);
      throw next;
    }
    return next;
  }

  release(err) {
    this.releases.push(err);
  }
}

const fakePool = (clients) => {
  const queue = [...clients];
  return { connect: vi.fn(async () => queue.shift()) };
};

const quietLog = () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() });

describe('resilientPool', () => {
  it('retries once on a dropped connection and returns the fresh result', async () => {
    const dead = new FakeClient([transient()]);
    const fresh = new FakeClient([{ rows: [{ ok: 1 }] }]);
    const pool = fakePool([dead, fresh]);
    const log = quietLog();
    resilientPool(pool, { delayMs: 0, log });

    const res = await pool.query('SELECT $1', [1]);

    expect(res.rows).toEqual([{ ok: 1 }]);
    expect(pool.connect).toHaveBeenCalledTimes(2);
    // The dead socket must be destroyed (release(err)), not reused.
    expect(dead.releases).toHaveLength(1);
    expect(dead.releases[0]).toBeInstanceOf(Error);
    expect(fresh.releases).toEqual([undefined]);
    expect(fresh.queries[0]).toEqual(['SELECT $1', [1]]);
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ECONNRESET', attempt: 0 }),
      'retrying database query after transient error'
    );
  });

  it('a client error event is absorbed instead of reaching uncaughtException', async () => {
    const dead = new FakeClient([transient('ECONNRESET')]);
    const fresh = new FakeClient([{ rows: [] }]);
    const pool = fakePool([dead, fresh]);
    resilientPool(pool, { delayMs: 0, log: quietLog() });

    // FakeClient emits 'error' before rejecting. If the wrapper did not attach
    // a listener, EventEmitter would throw and fail this test.
    await expect(pool.query('SELECT 1')).resolves.toEqual({ rows: [] });
    expect(dead.listenerCount('error')).toBe(0);
  });

  it('does not retry (or destroy the client) on a non-transient error', async () => {
    const err = Object.assign(new Error('duplicate key'), { code: '23505' });
    const client = new FakeClient([err]);
    const pool = fakePool([client]);
    resilientPool(pool, { delayMs: 0, log: quietLog() });

    await expect(pool.query('INSERT 1')).rejects.toThrow('duplicate key');
    expect(pool.connect).toHaveBeenCalledTimes(1);
    expect(client.releases).toEqual([undefined]);
  });

  it('gives up after the retry budget and surfaces the last error', async () => {
    const first = new FakeClient([transient('ETIMEDOUT')]);
    const second = new FakeClient([transient('ETIMEDOUT')]);
    const pool = fakePool([first, second]);
    resilientPool(pool, { delayMs: 0, log: quietLog() });

    await expect(pool.query('SELECT 1')).rejects.toMatchObject({ code: 'ETIMEDOUT' });
    expect(pool.connect).toHaveBeenCalledTimes(2);
  });

  it('retries a transient connect failure too', async () => {
    const fresh = new FakeClient([{ rows: [{ ok: 1 }] }]);
    const connect = vi
      .fn()
      .mockRejectedValueOnce(transient('ECONNREFUSED'))
      .mockResolvedValueOnce(fresh);
    const pool = { connect };
    resilientPool(pool, { delayMs: 0, log: quietLog() });

    await expect(pool.query('SELECT 1')).resolves.toEqual({ rows: [{ ok: 1 }] });
    expect(connect).toHaveBeenCalledTimes(2);
  });
});
