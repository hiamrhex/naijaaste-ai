import { getPool } from '../db/pool.js';
import { env } from '../env.js';
import { logger } from '../lib/logger.js';

const MAX_CALLS = env.LLM_MONTHLY_MAX;
const WARNING_THRESHOLD = 0.7;

if (MAX_CALLS > 0) {
  logger.info({ maxCalls: MAX_CALLS, warningPct: WARNING_THRESHOLD * 100 }, 'LLM monthly quota enabled');
} else {
  logger.warn('LLM monthly quota DISABLED (LLM_MONTHLY_MAX=0)');
}

const now = () => {
  const d = new Date();
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
};

export const checkAndIncrementQuota = async (subjectId, subjectType) => {
  if (MAX_CALLS === 0) return { allowed: true, remaining: Infinity, warned: false };

  const { year, month } = now();
  const pool = await getPool();
  const db = await pool.connect();

  try {
    await db.query('BEGIN');

    const { rows } = await db.query(
      `SELECT calls, warned_at_70
       FROM llm_quota
       WHERE subject_id = $1 AND subject_type = $2 AND year = $3 AND month = $4
       FOR UPDATE`,
      [subjectId, subjectType, year, month]
    );

    let calls = 0;
    let warnedAt70 = false;

    if (rows.length > 0) {
      calls = rows[0].calls;
      warnedAt70 = rows[0].warned_at_70;
    }

    if (calls >= MAX_CALLS) {
      await db.query('ROLLBACK');
      return {
        allowed: false,
        remaining: 0,
        limit: MAX_CALLS,
        retryAfterSec: secondsUntilMonthEnd(),
        error: `Monthly LLM quota exceeded (${MAX_CALLS} calls/month). Resets at month end.`,
      };
    }

    const newCalls = calls + 1;
    const newlyWarned = !warnedAt70 && newCalls >= Math.ceil(MAX_CALLS * WARNING_THRESHOLD);

    if (rows.length === 0) {
      await db.query(
        `INSERT INTO llm_quota (subject_id, subject_type, year, month, calls, warned_at_70)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [subjectId, subjectType, year, month, newCalls, newlyWarned]
      );
    } else {
      await db.query(
        `UPDATE llm_quota
         SET calls = $5, warned_at_70 = $6, updated_at = now()
         WHERE subject_id = $1 AND subject_type = $2 AND year = $3 AND month = $4`,
        [subjectId, subjectType, year, month, newCalls, newlyWarned]
      );
    }

    await db.query('COMMIT');

    if (newlyWarned) {
      logger.warn({ subjectId, subjectType, calls: newCalls, limit: MAX_CALLS, pct: Math.round((newCalls / MAX_CALLS) * 100) },
        'LLM monthly quota at 70% threshold');
    }

    return {
      allowed: true,
      remaining: MAX_CALLS - newCalls,
      limit: MAX_CALLS,
      warned: newlyWarned,
    };
  } catch (err) {
    try {
      await db.query('ROLLBACK');
    } catch { /* ignore */ }
    throw err;
  } finally {
    db.release();
  }
};

const secondsUntilMonthEnd = () => {
  const d = new Date();
  const nextMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return Math.ceil((nextMonth.getTime() - d.getTime()) / 1000);
};

export const getQuotaStatus = async (subjectId, subjectType) => {
  if (MAX_CALLS === 0) return { limit: 0, used: 0, remaining: Infinity };

  const { year, month } = now();
  const pool = await getPool();
  const { rows } = await pool.query(
    `SELECT calls FROM llm_quota
     WHERE subject_id = $1 AND subject_type = $2 AND year = $3 AND month = $4`,
    [subjectId, subjectType, year, month]
  );
  const used = rows[0]?.calls || 0;
  return { limit: MAX_CALLS, used, remaining: Math.max(0, MAX_CALLS - used) };
};