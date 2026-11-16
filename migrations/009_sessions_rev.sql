-- 009: Revision counter for optimistic concurrency on chat sessions.
--
-- Two turns for the same session (two tabs, a double-tapped send) both loaded
-- the same row and both wrote it back, so the second write silently discarded
-- the first turn's message. `updated_at` cannot be the version: Postgres stores
-- microseconds while a JS Date round-trips milliseconds, so an equality check
-- on it fails for reasons unrelated to concurrency. An integer that only this
-- writer increments is unambiguous.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS rev INTEGER NOT NULL DEFAULT 0;
