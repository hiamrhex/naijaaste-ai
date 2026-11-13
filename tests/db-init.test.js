import { describe, it, expect, vi, beforeEach } from 'vitest';

// Regression for two serverless cold-start defects in src/db/pool.js:
//
//   1. initDone was set before migrations ran, so a second concurrent request
//      on the same warm instance queried a database that had no schema yet.
//   2. a failed initialisation was never retried, so one transient Neon
//      failure left the instance serving 500s until the platform recycled it.
//
// A fake driver keeps the test deterministic; migrations and seeding are
// mocked so the test measures the initialisation contract, not pg-mem.

const state = vi.hoisted(() => ({
  migrateCalls: 0,
  seedCalls: 0,
  failMigrate: false,
  gate: null,
}));

vi.mock('pg', () => {
  class Pool {
    constructor() {
      this.on = () => {};
    }
    async query() {
      return { rows: [] };
    }
    async connect() {
      return {
        query: async () => ({ rows: [] }),
        release: () => {},
        on: () => {},
        off: () => {},
      };
    }
    async end() {}
  }
  return { default: { Pool } };
});

vi.mock('../src/db/migrate.js', () => ({
  runMigrations: async () => {
    state.migrateCalls += 1;
    if (state.gate) await state.gate.promise;
    if (state.failMigrate) throw new Error('migration failed');
    return [];
  },
}));

vi.mock('../src/db/seed.js', () => ({
  seedCatalogue: async () => {
    state.seedCalls += 1;
    return { seeded: 0 };
  },
}));

vi.stubEnv('DATABASE_URL', 'postgres://unit-test');
const { getPool, closePool } = await import('../src/db/pool.js');

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

beforeEach(async () => {
  await closePool();
  state.migrateCalls = 0;
  state.seedCalls = 0;
  state.failMigrate = false;
  state.gate = null;
});

describe('database initialisation', () => {
  it('runs migrations and seed once for concurrent callers', async () => {
    state.gate = deferred();
    let secondResolved = false;

    const first = getPool();
    const second = getPool().then((pool) => {
      secondResolved = true;
      return pool;
    });

    await tick();
    expect(state.migrateCalls).toBe(1);
    // The second caller must wait for the schema, not race ahead of it.
    expect(secondResolved).toBe(false);

    state.gate.resolve();
    await Promise.all([first, second]);

    expect(state.migrateCalls).toBe(1);
    expect(state.seedCalls).toBe(1);
  });

  it('retries initialisation after a failed cold start', async () => {
    state.failMigrate = true;
    await expect(getPool()).rejects.toThrow('migration failed');
    expect(state.migrateCalls).toBe(1);

    state.failMigrate = false;
    await expect(getPool()).resolves.toBeTruthy();
    expect(state.migrateCalls).toBe(2);
    expect(state.seedCalls).toBe(1);
  });
});
