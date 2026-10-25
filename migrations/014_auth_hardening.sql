-- Add auth hardening test data
-- This helps test auth enumeration oracles and brute-force protection
CREATE TABLE IF NOT EXISTS auth_hardening_tests (
  id SERIAL PRIMARY KEY,
  ip_address TEXT NOT NULL,
  email TEXT,
  attempt_type TEXT NOT NULL, -- 'signin', 'signup', 'forgot_password'
  success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  block_expires TIMESTAMPTZ
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_auth_hardening_tests_ip_address ON auth_hardening_tests (ip_address);
CREATE INDEX IF NOT EXISTS idx_auth_hardening_tests_email ON auth_hardening_tests (email);
CREATE INDEX IF NOT EXISTS idx_auth_hardening_tests_created_at ON auth_hardening_tests (created_at);
CREATE INDEX IF NOT EXISTS idx_auth_hardening_tests_is_blocked ON auth_hardening_tests (is_blocked);