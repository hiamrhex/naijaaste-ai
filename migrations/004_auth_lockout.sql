-- 004: brute-force lockout state (per account + client IP).
-- Keyed on (email, ip) rather than account alone: a shared NAT (carrier
-- grade NAT is common in Nigeria) must not let one attacker lock a whole
-- neighbourhood out of their accounts, and a locked entry must not reveal
-- whether the email exists at all — failures are counted for unknown emails
-- too, so the lock fires identically either way.

CREATE TABLE IF NOT EXISTS auth_attempts (
  email TEXT NOT NULL,
  ip TEXT NOT NULL,
  failures INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (email, ip)
);

CREATE INDEX IF NOT EXISTS idx_auth_attempts_updated ON auth_attempts (updated_at);
