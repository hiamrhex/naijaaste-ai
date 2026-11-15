import { describe, it, expect } from 'vitest';
import { recordFailure, lockStatus, clearFailures, LOCKOUT_POLICY } from '../src/auth/lockout.js';
import { getPool } from '../src/db/pool.js';

// An expired lock left the failure counter at MAX. lockStatus then reported
// "not locked", but the next single failure pushed the counter past the
// threshold and re-locked the pair for another 15 minutes, so every typo
// re-locked it and the user could never sign in.

const IP = '203.0.113.7';
const newEmail = () => `lock-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

const failTimes = async (email, times) => {
  let last;
  for (let i = 0; i < times; i += 1) last = await recordFailure(email, IP);
  return last;
};

describe('sign-in lockout', () => {
  it('locks the pair after the configured number of failures', async () => {
    const email = newEmail();
    const last = await failTimes(email, LOCKOUT_POLICY.MAX_FAILURES);

    expect(last.locked).toBe(true);
    expect((await lockStatus(email, IP)).locked).toBe(true);

    await clearFailures(email, IP);
  });

  it('starts a fresh count once the previous lock has expired', async () => {
    const email = newEmail();
    await failTimes(email, LOCKOUT_POLICY.MAX_FAILURES);

    // Expire the lock as time would.
    const pool = await getPool();
    await pool.query(
      'UPDATE auth_attempts SET locked_until = $3 WHERE email = $1 AND ip = $2',
      [email, IP, new Date(Date.now() - 1000).toISOString()]
    );
    expect((await lockStatus(email, IP)).locked).toBe(false);

    const afterExpiry = await recordFailure(email, IP);
    expect(afterExpiry.locked).toBe(false);
    expect(afterExpiry.failures).toBe(1);

    await clearFailures(email, IP);
  });

  it('clears the counter after a successful sign-in', async () => {
    const email = newEmail();
    await failTimes(email, 3);
    await clearFailures(email, IP);

    const status = await lockStatus(email, IP);
    expect(status).toEqual({ locked: false, failures: 0, retryAfterMs: 0 });
  });
});
