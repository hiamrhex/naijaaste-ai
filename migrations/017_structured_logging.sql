-- Add structured logging test data
-- This helps test request ID and structured logging functionality
CREATE TABLE IF NOT EXISTS logging_tests (
  id SERIAL PRIMARY KEY,
  request_id TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_processed BOOLEAN NOT NULL DEFAULT false
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_logging_tests_request_id ON logging_tests (request_id);
CREATE INDEX IF NOT EXISTS idx_logging_tests_level ON logging_tests (level);
CREATE INDEX IF NOT EXISTS idx_logging_tests_created_at ON logging_tests (created_at);
CREATE INDEX IF NOT EXISTS idx_logging_tests_is_processed ON logging_tests (is_processed);