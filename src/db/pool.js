import pg from 'pg';
import { env } from '../env.js';
import { runMigrations } from './migrate.js';
import { seedCatalogue } from './seed.js';
import { logger } from '../lib/logger.js';
import { getDbTiming, resetDbTiming, setDbTiming } from '../lib/dbTiming.js';

let pool = null;
let initDone = false;

// Cold-start evidence: how long Neon took to wake and how long the whole
// first-request init took. Surfaced on the next request log line alongside
// cold_start_ms (see middleware/requestId.js).
export { getDbTiming };

// Dual driver, one SQL surface:
//   - DATABASE_URL set  → real Postgres (Neon pooled URL at runtime).
//   - unset (tests, keyless dev) → pg-mem in-process Postgres.
// pg-mem is a devDependency, dynamically imported so production builds
// with --omit=dev never touch it. Never logs the URL.

// Connection-level failures that a pooled Postgres connection can raise
// mid-flight (the Neon pooler closes idle sessions on its own schedule).
const TRANSIENT = new Set([
  'ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ECONNREFUSED', 'EHOSTUNREACH',
  '57P01', // admin_shutdown
  '08000', '08001', '08003', '08006', '08004', // connection exceptions
]);

// pg-pool does not retry a statement whose connection died. On a pooled
// deployment that turns a routine server-side close into a 500 for the user.
// One retry on a fresh connection turns it back into a normal request.
const withRetry = (pool) => {
  const rawQuery = pool.query.bind(pool);
  pool.query = async (text, values) => {
    try {
      return await rawQuery(text, values);
    } catch (err) {
      if (!TRANSIENT.has(err.code)) throw err;
      const client = await pool.connect();
      try {
        return await client.query(text, values);
      } finally {
        client.release();
      }
    }
  };
  return pool;
};

export const getPool = async () => {
  if (!pool) {
    const createStart = Date.now();
    if (env.DATABASE_URL && env.DATABASE_URL.length > 0) {
      pool = withRetry(new pg.Pool({
        connectionString: env.DATABASE_URL,
        max: 3,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
        // The pooler can drop an idle socket without a FIN; TCP keepalive
        // turns that dead socket into a fast error instead of a hang.
        keepAlive: true,
        keepAliveInitialDelay: 10_000,
      }));
      pool.on('error', () => { /* idle client errors must not crash the process */ });
    } else {
      const { newDb } = await import('pg-mem');
      const db = newDb();
      db.public.registerFunction({
        name: 'gen_random_uuid',
        returns: 'uuid',
        implementation: () => crypto.randomUUID(),
        impure: true,
      });
      const { Pool } = db.adapters.createPg();
      pool = new Pool();
    }
    setDbTiming({ createMs: Date.now() - createStart });
  }
  if (!initDone) {
    initDone = true;
    const initStart = Date.now();
    try {
      // First real query pays the Neon wake-up; measure it separately from
      // migrations/seed so the log says which part was cold.
      const wakeStart = Date.now();
      await pool.query('SELECT 1');
      setDbTiming({ wakeMs: Date.now() - wakeStart });

      await runMigrations(pool);
      await seedCatalogue(pool);
      const dbTiming = { initMs: Date.now() - initStart, readyAt: new Date().toISOString() };
      setDbTiming(dbTiming);
      logger.info(
        {
          db_create_ms: getDbTiming().createMs,
          db_wake_ms: getDbTiming().wakeMs,
          db_init_ms: dbTiming.initMs,
          cold_start_ms: Math.round(process.uptime() * 1000),
        },
        'database ready'
      );
    } catch (err) {
      const initMs = Date.now() - initStart;
      setDbTiming({ initMs });
      logger.error(
        { err: err?.message, db_wake_ms: getDbTiming().wakeMs, db_init_ms: initMs },
        'database initialisation failed'
      );
      throw err;
    }
  }
  return pool;
};

export const dbEnabled = () => !!env.DATABASE_URL || process.env.NODE_ENV === 'test';

export const closePool = async () => {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
    initDone = false;
    resetDbTiming();
  }
};
