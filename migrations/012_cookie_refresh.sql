-- Add cookie refresh test data
-- This helps test cookie path and refresh functionality
CREATE TABLE IF NOT EXISTS cookie_tests (
  id SERIAL PRIMARY KEY,
  session_id UUID NOT NULL,
  cookie_name TEXT NOT NULL,
  cookie_value TEXT NOT NULL,
  path TEXT NOT NULL,
  domain TEXT,
  expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_refreshed BOOLEAN NOT NULL DEFAULT false
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_cookie_tests_session_id ON cookie_tests (session_id);
CREATE INDEX IF NOT EXISTS idx_cookie_tests_cookie_name ON cookie_tests (cookie_name);
CREATE INDEX IF NOT EXISTS idx_cookie_tests_is_refreshed ON cookie_tests (is_refreshed);