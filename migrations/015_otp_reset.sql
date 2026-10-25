-- Add OTP reset test data
-- This helps test seamless OTP reset functionality
CREATE TABLE IF NOT EXISTS otp_reset_tests (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  old_otp_hash TEXT NOT NULL,
  new_otp_hash TEXT NOT NULL,
  reset_token TEXT NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_otp_reset_tests_user_id ON otp_reset_tests (user_id);
CREATE INDEX IF NOT EXISTS idx_otp_reset_tests_reset_token ON otp_reset_tests (reset_token);
CREATE INDEX IF NOT EXISTS idx_otp_reset_tests_is_used ON otp_reset_tests (is_used);
CREATE INDEX IF NOT EXISTS idx_otp_reset_tests_expires_at ON otp_reset_tests (expires_at);