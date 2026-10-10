import { createHmac, randomInt, timingSafeEqual } from 'crypto';

// ─── OTP store (in-memory) ────────────────────────────────────────────────────
// Password-reset codes: 6 digits, SHA-256/HMAC-hashed at rest (never plaintext),
// 10-minute TTL, max 5 verify attempts, 60s resend cooldown.
// In-memory only — swap for Redis/DB before multi-instance (plan 007).

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

/** email(lowercased) -> { hash, expiresAt, attempts, createdAt } */
const store = new Map();

const pepper = () => process.env.JWT_ACCESS_SECRET || 'otp-dev-pepper';

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

const prune = () => {
  const now = Date.now();
  for (const [key, rec] of store) {
    if (now > rec.expiresAt + RESEND_COOLDOWN_MS) store.delete(key);
  }
};

/**
 * Issue a new OTP for an email. Throws { code: 'RESEND_COOLDOWN', retryAfterMs }
 * if one was issued within the cooldown window.
 * Returns the plaintext code — caller must deliver it (email/console) and never log it in prod.
 */
export const issueOtp = (email) => {
  prune();
  const key = email.toLowerCase().trim();
  const existing = store.get(key);
  const now = Date.now();
  if (existing && now - existing.createdAt < RESEND_COOLDOWN_MS) {
    const err = new Error('A new code was just sent — wait before requesting another');
    err.code = 'RESEND_COOLDOWN';
    err.retryAfterMs = RESEND_COOLDOWN_MS - (now - existing.createdAt);
    throw err;
  }
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  store.set(key, {
    hash: hashCode(key, code),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    createdAt: now,
  });
  return code;
};

/**
 * Verify an OTP. Always consumes an attempt; invalidates the code after
 * MAX_ATTEMPTS failures or on success.
 * Returns { ok: true } | { ok: false, reason: 'missing'|'expired'|'max_attempts'|'mismatch', attemptsLeft }
 */
export const verifyOtp = (email, code) => {
  const key = email.toLowerCase().trim();
  const rec = store.get(key);
  if (!rec) return { ok: false, reason: 'missing', attemptsLeft: 0 };

  const now = Date.now();
  if (now > rec.expiresAt) {
    store.delete(key);
    return { ok: false, reason: 'expired', attemptsLeft: 0 };
  }
  if (rec.attempts >= MAX_ATTEMPTS) {
    store.delete(key);
    return { ok: false, reason: 'max_attempts', attemptsLeft: 0 };
  }

  rec.attempts += 1;
  const match = typeof code === 'string' && /^\d{6}$/.test(code) && safeEqual(rec.hash, hashCode(key, code));

  if (match) {
    store.delete(key);
    return { ok: true };
  }
  if (rec.attempts >= MAX_ATTEMPTS) {
    store.delete(key);
    return { ok: false, reason: 'max_attempts', attemptsLeft: 0 };
  }
  return { ok: false, reason: 'mismatch', attemptsLeft: MAX_ATTEMPTS - rec.attempts };
};

export const clearOtp = (email) => store.delete(email.toLowerCase().trim());

// Test hook — lets unit tests drive expiry/attempts without waiting in real time.
export const __setOtpExpiry = (email, expiresAt) => {
  const rec = store.get(email.toLowerCase().trim());
  if (rec) rec.expiresAt = expiresAt;
};
