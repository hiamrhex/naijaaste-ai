import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import { env } from '../env.js';
import { logger } from '../lib/logger.js';
import { guardClientErrors } from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '../../migrations');

// Stable key for pg_advisory_lock. Every writer (the CLI, the refresh job and
// every serverless instance) must use the same value or the lock protects
// nothing.
export const MIGRATION_LOCK_ID = 802_311_017;

const applyMigrations = async (client) => {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const applied = new Set();
  try {
    const { rows } = await client.query('SELECT version FROM schema_migrations');
    for (const r of rows) applied.add(r.version);
  } catch (err) {
    if (!/does not exist|no such table/i.test(err.message)) throw err;
  }
  const ran = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    let sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');

    sql = sql.replace(/--.*$/gm, '');
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    console.log(`[MIGRATE] Running ${file} with ${statements.length} statements`);
    for (const stmt of statements) {
      console.log(`[MIGRATE] Executing: ${stmt.substring(0, 80)}...`);
      await client.query(stmt);
    }
    console.log(`[MIGRATE] Recording version for ${file}`);
    // Two writers can reach this line if one of them did not take the lock
    // (or if a lock was lost with its connection). The row is already applied,
    // so recording it twice is a no-op, not a crash.
    await client.query(
      'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING',
      [file]
    );
    ran.push(file);
  }
  return ran;
};

// Migrations are a single-writer operation, but nothing enforced that: Vercel
// can cold-start several instances at once and the refresh job runs on its own
// schedule, so two runners could see the same migration as unapplied and race
// on the same DDL. A Postgres advisory lock serialises them; the loser waits,
// then reads the updated schema_migrations and skips.
export const runMigrations = async (pool) => {
  // Advisory locks are per session, so the lock and the statements it protects
  // must share one connection.
  const client = typeof pool.connect === 'function'
    ? guardClientErrors(await pool.connect())
    : pool;
  let locked = false;
  try {
    try {
      await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
      locked = true;
    } catch (err) {
      // pg-mem (tests, keyless dev) has no advisory locks. A single process is
      // the only writer there, so proceeding is safe. Anything else is real.
      if (!/does not exist|not supported|syntax error/i.test(err.message)) throw err;
    }
    return await applyMigrations(client);
  } finally {
    if (locked) {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => {});
    }
    if (client !== pool) client.release?.();
  }
};

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('db/migrate.js');

if (isMain) {
  if (!env.DATABASE_URL && !env.DATABASE_URL_DIRECT) {
    console.error('migration failed: DATABASE_URL is not set (migrations target a real database; tests use ephemeral pg-mem automatically)');
    process.exitCode = 2;
  } else {
  // CLI builds its own pool (no import from pool.js — avoids a module cycle).
  // Prefers the direct URL (migrations must not run through the pooler).
  const connectionString = env.DATABASE_URL_DIRECT || env.DATABASE_URL;
  const pool = new pg.Pool({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 15_000,
  });
  try {
    const ran = await runMigrations(pool);
    const { seedCatalogue } = await import('./seed.js');
    const { seeded } = await seedCatalogue(pool);
    logger.info({ ran, seeded }, 'migrations complete');
    console.log(JSON.stringify({ ran, seeded }));
  } catch (err) {
    logger.error({ err: err.message, code: err.code }, 'migration failed');
    console.error(`migration failed: ${err.code || err.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
  }
}
