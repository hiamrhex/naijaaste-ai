import { getPool } from '../db/pool.js';
import { logger } from './logger.js';

export const DB_PROBE_TIMEOUT_MS = 2000;

// Readiness ≠ liveness: /health never probes the DB (it must stay up during
// an outage); /health/ready does, bounded by a 2s race so an unreachable DB
// answers 503 fast instead of hanging (see docs/RUNBOOK.md).
export const readinessProbe = async () => {
  try {
    const pool = await getPool();
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('db probe timeout')), DB_PROBE_TIMEOUT_MS).unref?.()
      ),
    ]);
    return { ready: true, db: 'up' };
  } catch (err) {
    logger.error({ err: err?.message }, 'readiness probe failed');
    return { ready: false, db: 'down' };
  }
};
