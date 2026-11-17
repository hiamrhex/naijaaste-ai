-- 011: a code is scoped to the flow that issued it.
--
-- One row per email served every purpose, so a code mailed for signup was also
-- spendable at /auth/reset-password. Purpose is part of the storage key and,
-- in the application layer, part of the HMAC input, so a leaked signup code
-- cannot be replayed as a password reset.
--
-- Existing rows default to 'reset': every code issued before this migration
-- came from the reset flow.
ALTER TABLE otps ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'reset';

ALTER TABLE otps DROP CONSTRAINT IF EXISTS otps_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS otps_email_purpose_key ON otps (email, purpose);
