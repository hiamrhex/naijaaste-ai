-- 010: an account is not usable until its mailbox is proven.
--
-- Before this, /auth/signup minted access + refresh tokens in the same handler
-- that hashed the password, so "I typed this address" and "I control this
-- address" were the same thing to the server.
--
-- Backfill rule: a Google account was verified by Google when the identity
-- credential was issued, so google_sub IS NOT NULL is real proof. Every other
-- existing account is left unverified and its refresh tokens are deleted: a
-- session minted before this migration was never backed by proof of mailbox
-- control.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

UPDATE users SET email_verified = true WHERE google_sub IS NOT NULL;

DELETE FROM refresh_tokens
 WHERE user_id IN (SELECT id FROM users WHERE email_verified = false);
