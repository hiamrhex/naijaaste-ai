import pg from 'pg';
import { env } from '../env.js';
import { runMigrations } from './migrate.js';
import { seedCatalogue } from './seed.js';

let pool = null;
let initDone = false;

// Dual driver, one SQL surface:
//   - DATABASE_URL set  → real Postgres (Neon pooled URL at runtime).
//   - unset (tests, keyless dev) → pg-mem in-process Postgres.
// pg-mem is a devDependency, dynamically imported so production builds
// with --omit=dev never touch it. Never logs the URL.
export const getPool = async () => {
  if (!pool) {
    if (env.DATABASE_URL) {
      pool = new pg.Pool({
        connectionString: env.DATABASE_URL,
        max: 3,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 10_000,
      });
      pool.on('error', () => { /* idle client errors must not crash the process */ });
    } else {
      const { newDb } = await import('pg-mem');
      const { Pool } = newDb().adapters.createPg();
      pool = new Pool();
    }
  }
  if (!initDone) {
    initDone = true;
    await runMigrations(pool);
    await seedCatalogue(pool);
  }
  return pool;
};

export const dbEnabled = () => !!env.DATABASE_URL || process.env.NODE_ENV === 'test';

export const closePool = async () => {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
    initDone = false;
  }
};
