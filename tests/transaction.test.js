import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Regression for account deletion: it sent BEGIN/COMMIT through pool.query,
// which checks out a *different* connection per call. Each DELETE therefore
// autocommitted on its own session, so a failure halfway through erased part of
// the account while the user row survived. The rollback landed on an idle
// connection that was then returned to the pool mid-transaction.

const state = vi.hoisted(() => ({ clients: [], releases: [] }));

vi.mock('pg', () => {
  let nextId = 0;
  class Pool {
    constructor() {
      this.on = () => {};
    }
    async query() {
      return { rows: [] };
    }
    async connect() {
      const id = nextId++;
      const queries = [];
      state.clients.push({ id, queries });
      return {
        id,
        query: async (text) => {
          queries.push(text);
          return { rows: [] };
        },
        release: () => state.releases.push(id),
        on: () => {},
        off: () => {},
      };
    }
    async end() {}
  }
  return { default: { Pool } };
});

vi.mock('../src/db/migrate.js', () => ({
  runMigrations: async () => [],
  MIGRATION_LOCK_ID: 1,
}));

vi.mock('../src/db/seed.js', () => ({
  seedCatalogue: async () => ({ seeded: 0 }),
}));

vi.stubEnv('DATABASE_URL', 'postgres://unit-test');
const { withTransaction, closePool } = await import('../src/db/pool.js');

beforeEach(async () => {
  await closePool();
  state.clients.length = 0;
  state.releases.length = 0;
});

const lastClient = () => state.clients[state.clients.length - 1];

describe('withTransaction', () => {
  it('runs BEGIN, the work and COMMIT on one connection', async () => {
    await withTransaction(async (db) => {
      await db.query('DELETE FROM ratings');
      await db.query('DELETE FROM users');
    });

    const tx = lastClient();
    expect(tx.queries).toEqual([
      'BEGIN',
      'DELETE FROM ratings',
      'DELETE FROM users',
      'COMMIT',
    ]);
    // The same connection is returned to the pool exactly once.
    expect(state.releases.filter((id) => id === tx.id)).toEqual([tx.id]);
  });

  it('rolls back and still releases the connection when the work throws', async () => {
    await expect(
      withTransaction(async (db) => {
        await db.query('DELETE FROM ratings');
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    const tx = lastClient();
    expect(tx.queries).toEqual(['BEGIN', 'DELETE FROM ratings', 'ROLLBACK']);
    expect(state.releases.filter((id) => id === tx.id)).toEqual([tx.id]);
  });

  it('returns the callback result', async () => {
    await expect(withTransaction(async () => 'ok')).resolves.toBe('ok');
  });
});

// Class-level guard: the defect was not the deletes, it was sending transaction
// control to a pool. Anything that names a pool and sends BEGIN/COMMIT/ROLLBACK
// through it is the same bug.
describe('transaction control never goes through a pool', () => {
  const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

  const walk = (dir) =>
    readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });

  it('finds no pool.query(BEGIN|COMMIT|ROLLBACK)', () => {
    const offenders = [];
    for (const file of walk(srcDir).filter((f) => f.endsWith('.js'))) {
      const text = readFileSync(file, 'utf8');
      const matches = text.match(/\bpool\.query\(\s*['"](BEGIN|COMMIT|ROLLBACK)['"]/g);
      if (matches) offenders.push({ file: file.replace(srcDir, 'src'), matches });
    }
    expect(offenders).toEqual([]);
  });
});
