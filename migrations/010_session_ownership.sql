-- Add session ownership validation test data
-- This helps test session binding to owners functionality
CREATE TABLE IF NOT EXISTS session_ownership_tests (
  id SERIAL PRIMARY KEY,
  session_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_accessed TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_valid BOOLEAN NOT NULL DEFAULT true
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_session_ownership_tests_session_id ON session_ownership_tests (session_id);
CREATE INDEX IF NOT EXISTS idx_session_ownership_tests_owner_id ON session_ownership_tests (owner_id);