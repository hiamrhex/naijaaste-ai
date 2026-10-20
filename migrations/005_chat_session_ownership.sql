-- 005: chat session ownership.
--
-- Every chat session gets an owner:
--   - signed-in sessions  -> user_id points at the user
--   - anonymous sessions  -> capability_hash stores a SHA-256 of a bearer
--     capability that only the creator ever sees
--
-- GET/DELETE /chat/:id accept EITHER the owning user's access token OR the
-- session's bearer capability. Everyone else gets 404 (never 403/401 — that
-- would confirm that a session id exists).
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS capability_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_sessions_capability ON sessions (capability_hash);
