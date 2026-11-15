import { describe, it, expect } from 'vitest';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runMigrations, MIGRATION_LOCK_ID } from '../src/db/migrate.js';

// Migrations are single-writer, but nothing enforced it before: Vercel can
// cold-start several instances at once and the refresh job runs on its own
// schedule, so two runners could read the same migration as unapplied and race
// on the same DDL (duplicate constraint, duplicate schema_migrations row).
//
// These tests use a fake pool that models a real advisory lock (a mutex shared
// by every client) and a shared schema_migrations table, so the serialisation
// contract is exercised without a database.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationFiles = readdirSync(join(root, 'migrations')).filter((f) => f.endsWith('.sql'));

const makePool = ({ locks = true, failOn = null } = {}) => {
  const applied = new Set();
  const events = [];
  let lockHeld = false;
  const waiters = [];

  const acquire = async () => {
    if (lockHeld) await new Promise((resolve) => waiters.push(resolve));
    lockHeld = true;
    events.push('lock');
  };

  const unlock = () => {
    lockHeld = false;
    events.push('unlock');
    const next = waiters.shift();
    if (next) next();
  };

  const makeClient = () => ({
    query: async (text, params) => {
      if (/pg_advisory_lock/.test(text)) {
        if (!locks) throw new Error('ERROR: function pg_advisory_lock(integer) does not exist');
        await acquire();
        return { rows: [] };
      }
      if (/pg_advisory_unlock/.test(text)) {
        unlock();
        return { rows: [] };
      }
      if (/SELECT version FROM schema_migrations/.test(text)) {
        events.push('select');
        return { rows: [...applied].map((version) => ({ version })) };
      }
      if (/INSERT INTO schema_migrations/.test(text)) {
        events.push('insert:' + params[0]);
        applied.add(params[0]);
        return { rows: [] };
      }
      if (failOn && failOn.test(text)) throw new Error('ddl failed');
      events.push('statement');
      return { rows: [] };
    },
    release: () => events.push('release'),
  });

  return {
    connect: async () => makeClient(),
    query: (...args) => makeClient().query(...args),
    applied,
    events,
  };
};

describe('migration runner', () => {
  it('applies each migration exactly once when two runners start together', async () => {
    const pool = makePool();

    const [first, second] = await Promise.all([runMigrations(pool), runMigrations(pool)]);

    // Both runners report what they applied; together they cover every file.
    const applied = [...first, ...second];
    expect(applied.sort()).toEqual([...migrationFiles].sort());
    expect(new Set(applied).size).toBe(migrationFiles.length);
    expect(pool.applied.size).toBe(migrationFiles.length);
  });

  it('makes the second runner wait for the lock instead of reading a stale schema', async () => {
    const pool = makePool();
    await Promise.all([runMigrations(pool), runMigrations(pool)]);

    // The lock is taken before the first read and released after the last
    // insert; the second read therefore cannot see a half-applied schema.
    expect(pool.events[0]).toBe('lock');
    const firstUnlock = pool.events.indexOf('unlock');
    const selects = pool.events
      .map((event, index) => ({ event, index }))
      .filter(({ event }) => event === 'select');
    expect(selects).toHaveLength(2);
    expect(selects[1].index).toBeGreaterThan(firstUnlock);
  });

  it('records the version with ON CONFLICT so a lost lock cannot crash the runner', async () => {
    const pool = makePool();
    const originalQuery = pool.connect;
    const statements = [];
    pool.connect = async () => {
      const client = await originalQuery();
      const wrapped = client.query;
      client.query = (text, params) => {
        statements.push(text);
        return wrapped(text, params);
      };
      return client;
    };

    await runMigrations(pool);

    const insert = statements.find((text) => /INSERT INTO schema_migrations/.test(text));
    expect(insert).toBeTruthy();
    expect(insert).toMatch(/ON CONFLICT DO NOTHING/);
  });

  it('uses the shared lock key', async () => {
    expect(MIGRATION_LOCK_ID).toBeGreaterThan(0);
    const pool = makePool();
    const seen = [];
    const originalQuery = pool.connect;
    pool.connect = async () => {
      const client = await originalQuery();
      const wrapped = client.query;
      client.query = (text, params) => {
        seen.push({ text, params });
        return wrapped(text, params);
      };
      return client;
    };

    await runMigrations(pool);

    const lock = seen.find(({ text }) => /pg_advisory_lock/.test(text));
    expect(lock.params).toEqual([MIGRATION_LOCK_ID]);
  });

  it('still migrates on an engine without advisory locks', async () => {
    // pg-mem implements very few native functions; tests and keyless dev must
    // keep working, and a single process is the only writer there.
    const pool = makePool({ locks: false });

    const ran = await runMigrations(pool);

    expect(ran.sort()).toEqual([...migrationFiles].sort());
    expect(pool.events).not.toContain('unlock');
  });

  it('releases the lock and the connection when a statement fails', async () => {
    const pool = makePool({ failOn: /CREATE TABLE/i });
    const originalQuery = pool.connect;
    let released = 0;
    pool.connect = async () => {
      const client = await originalQuery();
      const release = client.release;
      client.release = () => {
        released += 1;
        release();
      };
      return client;
    };

    await expect(runMigrations(pool)).rejects.toThrow('ddl failed');

    expect(pool.events).toContain('unlock');
    expect(released).toBe(1);
  });
});
