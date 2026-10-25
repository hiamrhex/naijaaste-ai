-- Add CORS configuration test data
-- This helps test CORS allowlist functionality
CREATE TABLE IF NOT EXISTS cors_tests (
  id SERIAL PRIMARY KEY,
  origin TEXT NOT NULL,
  method TEXT NOT NULL,
  headers TEXT,
  is_allowed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_cors_tests_origin ON cors_tests (origin);
CREATE INDEX IF NOT EXISTS idx_cors_tests_is_allowed ON cors_tests (is_allowed);