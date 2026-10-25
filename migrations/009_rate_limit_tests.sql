-- Add rate limiting test data for testing rate limiter functionality
-- This helps test the rate limiting behavior in the test suite
CREATE TABLE IF NOT EXISTS rate_limit_tests (
  id SERIAL PRIMARY KEY,
  ip_address TEXT NOT NULL,
  path TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_tests_ip_path ON rate_limit_tests (ip_address, path);
CREATE INDEX IF NOT EXISTS idx_rate_limit_tests_timestamp ON rate_limit_tests (timestamp);