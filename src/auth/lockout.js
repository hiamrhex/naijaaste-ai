import { getPool } from '../db/pool.js';

// ─── Brute-force lockout ─────────────────────────────────────────────────────
// Failed sign-ins are counted per (email, client IP). Ten failures lock that
// pair for 15 minutes; a success clears the counter.
//
// Why (email, ip) and not email alone:
//   - Account-lockout DoS — an attacker who knows someone's email could
//     otherwise lock that person out forever. Keyed by IP, only the
//     attacker's own path is locked.
//   - No enumeration oracle — failures are counted for unknown emails too, so
//     the 429 ACCOUNT_LOCKED response fires identically whether or not the
//     account exists.
//   - Shared NAT — Nigerian mobile carriers put whole neighbourhoods behind
//     one IP; a per-account lock would punish every unrelated user on it.

const MAX_FAILURES = 10;
const LOCK_MS = 15 * 60 * 1000;
const RETENTION_MS = 60 * 60 * 1000;

const key = (email) => (email || '').toLowerCase().trim();

const prune = async (pool, now) => {
  await pool.query('DELETE FROM auth_attempts WHERE updated_at < $1', [
    new Date(now - RETENTION_MS).toISOString(),
  ]);
};

/**
 * Current lock state for an (email, ip) pair.
 * @returns {Promise<{locked: boolean, failures: number, retryAfterMs: number}>}
 */
export const lockStatus = async (email, ip) => {
  const pool = await getPool();
  const { rows } = await pool.query(
    'SELECT failures, locked_until FROM auth_attempts WHERE email = $1 AND ip = $2',
    [key(email), ip]
  );
  const rec = rows[0];
  if (!rec) return { locked: false, failures: 0, retryAfterMs: 0 };
  const until = rec.locked_until ? new Date(rec.locked_until).getTime() : 0;
  const now = Date.now();
  if (until > now) {
    return { locked: true, failures: rec.failures, retryAfterMs: until - now };
  }
  return { locked: false, failures: rec.failures, retryAfterMs: 0 };
};

/**
 * Count one failed sign-in. Locks the pair once the threshold is reached.
 * @returns {Promise<{locked: boolean, failures: number, retryAfterMs: number}>}
 */
export const recordFailure = async (email, ip) => {
  const pool = await getPool();
  const now = Date.now();
  await prune(pool, now);
  await pool.query(
    `INSERT INTO auth_attempts (email, ip, failures, updated_at)
     VALUES ($1, $2, 1, $3)
     ON CONFLICT (email, ip) DO UPDATE SET
       failures = auth_attempts.failures + 1,
       updated_at = $3`,
    [key(email), ip, new Date(now).toISOString()]
  );
  const { rows } = await pool.query(
    'SELECT failures FROM auth_attempts WHERE email = $1 AND ip = $2',
    [key(email), ip]
  );
  const failures = rows[0]?.failures ?? 1;
  if (failures < MAX_FAILURES) {
    return { locked: false, failures, retryAfterMs: 0 };
  }
  const until = new Date(now + LOCK_MS).toISOString();
  await pool.query(
    'UPDATE auth_attempts SET locked_until = $3 WHERE email = $1 AND ip = $2',
    [key(email), ip, until]
  );
  return { locked: true, failures, retryAfterMs: LOCK_MS };
};

/** Clear the counter after a successful sign-in. */
export const clearFailures = async (email, ip) => {
  const pool = await getPool();
  await pool.query('DELETE FROM auth_attempts WHERE email = $1 AND ip = $2', [key(email), ip]);
};

export const LOCKOUT_POLICY = { MAX_FAILURES, LOCK_MS };
