import { describe, it, expect } from 'vitest';
import { issueOtp, verifyOtp } from '../src/auth/otp.js';
import { getPool } from '../src/db/pool.js';

// The resend cooldown was check-then-act: both requests read the row (or the
// absence of one), both decided they could send, and both upserted. Two emails
// went out with different codes, and the code in the first one was dead on
// arrival because the second upsert had overwritten it.

const newEmail = () => `otp-race-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

describe('OTP resend cooldown', () => {
  it('lets exactly one of two concurrent requests issue a code', async () => {
    const email = newEmail();

    const results = await Promise.allSettled([issueOtp(email), issueOtp(email)]);
    const issued = results.filter((r) => r.status === 'fulfilled');
    const refused = results.filter((r) => r.status === 'rejected');

    expect(issued).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(refused[0].reason.code).toBe('RESEND_COOLDOWN');
    expect(refused[0].reason.retryAfterMs).toBeGreaterThan(0);

    // The one code that was mailed must still be the valid one.
    await expect(verifyOtp(email, issued[0].value)).resolves.toMatchObject({ ok: true });
  });

  it('issues a new code once the cooldown has elapsed and kills the old one', async () => {
    const email = newEmail();
    const first = await issueOtp(email);

    // Move the row's created_at past the cooldown, as 60 seconds would.
    const pool = await getPool();
    await pool.query(
      'UPDATE otps SET created_at = $2 WHERE email = $1',
      [email, new Date(Date.now() - 61_000).toISOString()]
    );

    const second = await issueOtp(email);
    expect(second).not.toBe(first);
    await expect(verifyOtp(email, first)).resolves.toMatchObject({ ok: false });
    await expect(verifyOtp(email, second)).resolves.toMatchObject({ ok: true });
  });
});
