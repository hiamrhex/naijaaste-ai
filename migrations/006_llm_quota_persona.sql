-- 006: align the llm_quota subject constraint with the quotas we actually use.
--
-- The live database still carries the original constraint
--   CHECK (subject_type IN ('user', 'capability'))
-- from the first quota migration, but /recommend attributes anonymous callers
-- to their persona_id (subject_type = 'persona'). Every anonymous
-- recommendation therefore failed the CHECK and returned 500 INTERNAL.
--
-- CREATE TABLE IF NOT EXISTS in 001 means fresh databases never applied the
-- old constraint; this migration reconciles existing ones without dropping
-- quota history. The index is restored for installations created by 001.
ALTER TABLE llm_quota DROP CONSTRAINT IF EXISTS llm_quota_subject_type_check;
ALTER TABLE llm_quota ADD CONSTRAINT llm_quota_subject_type_check CHECK (subject_type IN ('user', 'capability', 'persona'));
CREATE INDEX IF NOT EXISTS idx_llm_quota_updated ON llm_quota (updated_at);
