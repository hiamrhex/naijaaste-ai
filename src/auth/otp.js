import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { getPool } from '../db/pool.js';
import { env } from '../env.js';

// ─── OTP store (Postgres) ─────────────────────────────────────────────────────
// Password-reset codes: 6 digits, SHA-256/HMAC-hashed at rest (never plaintext),
// 10-minute TTL, max 5 verify attempts, 60s resend cooldown.
// Same contract as the old in-memory version; survives restarts and scales
// past a single process.

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

// A code is only valid for the flow that issued it. Purpose is part of the
// HMAC input AND part of the storage key (migration 011), so a signup code is
// not a password-reset code even to someone who reads both tables.
export const PURPOSES = ['signup', 'reset'];

const pepper = () => env.JWT_ACCESS_SECRET || 'otp-dev-pepper';

const hashCode = (email, purpose, code) =>
  createHmac('sha256', pepper()).update(`${purpose}:${email}:${code}`).digest('hex');

const safeEqual = (a, b) => {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
};

const prune = async (pool, now) => {
  await pool.query('DELETE FROM otps WHERE expires_at < $1', [new Date(now - RESEND_COOLDOWN_MS).toISOString()]);
};

const resendError = (retryAfterMs) => {
  const err = new Error('A new code was just sent — wait before requesting another');
  err.code = 'RESEND_COOLDOWN';
  err.retryAfterMs = Math.max(0, retryAfterMs);
  return err;
};

/**
 * Issue a new OTP for an email. Throws { code: 'RESEND_COOLDOWN', retryAfterMs }
 * if one was issued within the cooldown window.
 *
 * `force` re-issues regardless of the cooldown. It exists for the one case
 * where the cooldown protects nothing: dev mode without SMTP, where the code
 * is shown in the response instead of being mailed, so there is no inbox to
 * bomb and the caller must always get a usable code.
 *
 * Returns the plaintext code — caller must deliver it (email/console) and never log it in prod.
 */
export const issueOtp = async (email, { force = false, purpose = 'reset' } = {}) => {
  if (!PURPOSES.includes(purpose)) throw new Error(`unknown OTP purpose: ${purpose}`);
  const pool = await getPool();
  const now = Date.now();
  await prune(pool, now);
  const key = email.toLowerCase().trim();
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  const codeHash = hashCode(key, purpose, code);
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + OTP_TTL_MS).toISOString();

  if (force) {
    await pool.query(
      `INSERT INTO otps (email, purpose, code_hash, expires_at, attempts, created_at)
       VALUES ($1, $2, $3, $4, 0, $5)
       ON CONFLICT (email, purpose) DO UPDATE SET
         code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at,
         attempts = 0, created_at = EXCLUDED.created_at`,
      [key, purpose, codeHash, expiresAt, createdAt]
    );
    return code;
  }

  // Claim the cooldown window inside the write. A read-then-write check let two
  // concurrent requests both see no recent row and both mail a code; the second
  // overwrote the first, so the code in the earlier email was already dead.
  const cutoff = new Date(now - RESEND_COOLDOWN_MS).toISOString();
  const { rows: replaced } = await pool.query(
    `UPDATE otps SET code_hash = $3, expires_at = $4, attempts = 0, created_at = $5
     WHERE email = $1 AND purpose = $2 AND created_at <= $6
     RETURNING email`,
    [key, purpose, codeHash, expiresAt, createdAt, cutoff]
  );
  if (replaced.length) return code;

  const { rows } = await pool.query('SELECT created_at FROM otps WHERE email = $1 AND purpose = $2', [key, purpose]);
  if (rows[0]) {
    const elapsed = now - new Date(rows[0].created_at).getTime();
    throw resendError(RESEND_COOLDOWN_MS - elapsed);
  }

  // First code for this address. The (email, purpose) unique index is the
  // claim: if a concurrent request inserted first, this one must not send a
  // second email.
  try {
    await pool.query(
      `INSERT INTO otps (email, purpose, code_hash, expires_at, attempts, created_at)
       VALUES ($1, $2, $3, $4, 0, $5)`,
      [key, purpose, codeHash, expiresAt, createdAt]
    );
  } catch (err) {
    if (err.code === '23505') throw resendError(RESEND_COOLDOWN_MS);
    throw err;
  }
  return code;
};

/**
 * Verify an OTP. Always consumes an attempt; invalidates the code after
 * MAX_ATTEMPTS failures or on success.
 * Returns { ok: true } | { ok: false, reason: 'missing'|'expired'|'max_attempts'|'mismatch', attemptsLeft }
 *
 * Timing contract: "no code was ever issued for this address" and "the code
 * is wrong" must cost the same, otherwise the response time enumerates
 * accounts. The attempt-claim UPDATE and the HMAC comparison therefore run
 * on BOTH paths (the UPDATE matches no row when there is nothing to claim).
 */
export const verifyOtp = async (email, code, purpose = 'reset') => {
  if (!PURPOSES.includes(purpose)) throw new Error(`unknown OTP purpose: ${purpose}`);
  const pool = await getPool();
  const key = email.toLowerCase().trim();
  const { rows } = await pool.query('SELECT * FROM otps WHERE email = $1 AND purpose = $2', [key, purpose]);
  const rec = rows[0];

  const now = Date.now();

  // Claim the attempt atomically: the WHERE clause is the lock. A read-then-write
  // counter let two concurrent guesses both spend the same attempt, so a valid
  // code could be rejected while a wrong one had already used it up.
  // This runs even when no row exists — it is half of the equal-cost work.
  const { rows: claimed } = await pool.query(
    `UPDATE otps SET attempts = attempts + 1
     WHERE email = $1 AND purpose = $2 AND attempts < $3
     RETURNING attempts, code_hash`,
    [key, purpose, MAX_ATTEMPTS]
  );

  if (!rec) {
    // Nothing was ever issued for this address. Do the same comparison the
    // mismatch path does, so both answers cost the same wall-clock time.
    safeEqual(hashCode(key, purpose, '000000'), hashCode(key, purpose, '000000'));
    return { ok: false, reason: 'missing', attemptsLeft: 0 };
  }

  if (now > new Date(rec.expires_at).getTime()) {
    await pool.query('DELETE FROM otps WHERE email = $1 AND purpose = $2', [key, purpose]);
    return { ok: false, reason: 'expired', attemptsLeft: 0 };
  }

  if (!claimed.length) {
    await pool.query('DELETE FROM otps WHERE email = $1 AND purpose = $2', [key, purpose]);
    return { ok: false, reason: 'max_attempts', attemptsLeft: 0 };
  }

  const attempts = claimed[0].attempts;
  const match = typeof code === 'string' && /^\d{6}$/.test(code)
    && safeEqual(claimed[0].code_hash, hashCode(key, purpose, code));

  if (match) {
    await pool.query('DELETE FROM otps WHERE email = $1 AND purpose = $2', [key, purpose]);
    return { ok: true };
  }
  if (attempts >= MAX_ATTEMPTS) {
    await pool.query('DELETE FROM otps WHERE email = $1 AND purpose = $2', [key, purpose]);
    return { ok: false, reason: 'max_attempts', attemptsLeft: 0 };
  }
  return { ok: false, reason: 'mismatch', attemptsLeft: MAX_ATTEMPTS - attempts };
};

export const clearOtp = async (email, purpose = 'reset') => {
  const pool = await getPool();
  await pool.query('DELETE FROM otps WHERE email = $1 AND purpose = $2', [email.toLowerCase().trim(), purpose]);
};

// Test hook — lets unit tests drive expiry/attempts without waiting in real time.
export const __setOtpExpiry = async (email, expiresAt, purpose = 'reset') => {
  const pool = await getPool();
  await pool.query('UPDATE otps SET expires_at = $3 WHERE email = $1 AND purpose = $2', [
    email.toLowerCase().trim(),
    purpose,
    new Date(expiresAt).toISOString(),
  ]);
};
