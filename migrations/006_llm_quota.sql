-- 006: monthly LLM quota counter per user.
--
-- Tracks AI call consumption per user per calendar month. Enforces a
-- configurable ceiling (default 100 calls/month) with a 70% warning log.
-- Anonymous sessions are attributed to their capability hash; signed-in
-- sessions to their user_id. Both are stored under the same table with
-- a polymorphic `subject_id` + `subject_type` ('user' | 'capability').
CREATE TABLE IF NOT EXISTS llm_quota (
  subject_id   TEXT NOT NULL,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('user', 'capability')),
  year         INTEGER NOT NULL,
  month        INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  calls        INTEGER NOT NULL DEFAULT 0,
  warned_at_70 BOOLEAN NOT NULL DEFAULT false,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_id, subject_type, year, month)
);
CREATE INDEX IF NOT EXISTS idx_llm_quota_updated ON llm_quota (updated_at);