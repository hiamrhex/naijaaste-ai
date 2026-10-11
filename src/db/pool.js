import pg from 'pg';
import { env } from '../env.js';

let pool = null;

// Small pool on purpose: Neon free tier caps connections; serverless-style
// usage must open few, short-lived connections. Never logs the URL.
export const getPool = () => {
  if (!env.DATABASE_URL) {
    const err = new Error('DATABASE_URL is not configured');
    err.code = 'DB_NOT_CONFIGURED';
    throw err;
  }
  if (!pool) {
    pool = new pg.Pool({
      connectionString: env.DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
    pool.on('error', () => { /* idle client errors must not crash the process */ });
  }
  return pool;
};

export const dbEnabled = () => !!env.DATABASE_URL;

export const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};
