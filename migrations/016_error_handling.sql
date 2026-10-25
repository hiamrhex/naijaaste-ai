-- Add error handling test data
-- This helps test error contract and status codes
CREATE TABLE IF NOT EXISTS error_handling_tests (
  id SERIAL PRIMARY KEY,
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL,
  http_status INTEGER NOT NULL,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_handled BOOLEAN NOT NULL DEFAULT false
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_error_handling_tests_error_code ON error_handling_tests (error_code);
CREATE INDEX IF NOT EXISTS idx_error_handling_tests_http_status ON error_handling_tests (http_status);
CREATE INDEX IF NOT EXISTS idx_error_handling_tests_is_handled ON error_handling_tests (is_handled);