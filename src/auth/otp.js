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

const pepper = () => env.JWT_ACCESS_SECRET || 'otp-dev-pepper';

const hashCode = (email, code) =>
  createHmac('sha256', pepper()).update(`${email}:${code}`).digest('hex');

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

/**
 * Issue a new OTP for an email. Throws { code: 'RESEND_COOLDOWN', retryAfterMs }
 * if one was issued within the cooldown window.
 * Returns the plaintext code — caller must deliver it (email/console) and never log it in prod.
 */
export const issueOtp = async (email) => {
  const pool = await getPool();
  const now = Date.now();
  await prune(pool, now);
  const key = email.toLowerCase().trim();
  const { rows } = await pool.query('SELECT created_at FROM otps WHERE email = $1', [key]);
  if (rows[0]) {
    const createdAt = new Date(rows[0].created_at).getTime();
    if (now - createdAt < RESEND_COOLDOWN_MS) {
      const err = new Error('A new code was just sent — wait before requesting another');
      err.code = 'RESEND_COOLDOWN';
      err.retryAfterMs = RESEND_COOLDOWN_MS - (now - createdAt);
      throw err;
    }
  }
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  await pool.query(
    `INSERT INTO otps (email, code_hash, expires_at, attempts, created_at)
     VALUES ($1, $2, $3, 0, $4)
     ON CONFLICT (email) DO UPDATE SET
       code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at,
       attempts = 0, created_at = EXCLUDED.created_at`,
    [key, hashCode(key, code), new Date(now + OTP_TTL_MS).toISOString(), new Date(now).toISOString()]
  );
  return code;
};

/**
 * Verify an OTP. Always consumes an attempt; invalidates the code after
 * MAX_ATTEMPTS failures or on success.
 * Returns { ok: true } | { ok: false, reason: 'missing'|'expired'|'max_attempts'|'mismatch', attemptsLeft }
 */
export const verifyOtp = async (email, code) => {
  const pool = await getPool();
  const key = email.toLowerCase().trim();
  const { rows } = await pool.query('SELECT * FROM otps WHERE email = $1', [key]);
  const rec = rows[0];
  if (!rec) return { ok: false, reason: 'missing', attemptsLeft: 0 };

  const now = Date.now();
  if (now > new Date(rec.expires_at).getTime()) {
    await pool.query('DELETE FROM otps WHERE email = $1', [key]);
    return { ok: false, reason: 'expired', attemptsLeft: 0 };
  }
  if (rec.attempts >= MAX_ATTEMPTS) {
    await pool.query('DELETE FROM otps WHERE email = $1', [key]);
    return { ok: false, reason: 'max_attempts', attemptsLeft: 0 };
  }

  const attempts = rec.attempts + 1;
  const match = typeof code === 'string' && /^\d{6}$/.test(code) && safeEqual(rec.code_hash, hashCode(key, code));

  if (match) {
    await pool.query('DELETE FROM otps WHERE email = $1', [key]);
    return { ok: true };
  }
  if (attempts >= MAX_ATTEMPTS) {
    await pool.query('DELETE FROM otps WHERE email = $1', [key]);
    return { ok: false, reason: 'max_attempts', attemptsLeft: 0 };
  }
  await pool.query('UPDATE otps SET attempts = $2 WHERE email = $1', [key, attempts]);
  return { ok: false, reason: 'mismatch', attemptsLeft: MAX_ATTEMPTS - attempts };
};

export const clearOtp = async (email) => {
  const pool = await getPool();
  await pool.query('DELETE FROM otps WHERE email = $1', [email.toLowerCase().trim()]);
};

// Test hook — lets unit tests drive expiry/attempts without waiting in real time.
export const __setOtpExpiry = async (email, expiresAt) => {
  const pool = await getPool();
  await pool.query('UPDATE otps SET expires_at = $2 WHERE email = $1', [
    email.toLowerCase().trim(),
    new Date(expiresAt).toISOString(),
  ]);
};
