import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { getPool } from '../src/db/pool.js';
import { checkAndIncrementQuota } from '../src/services/llm-quota.service.js';

// Regression for the production-only 500 on POST /recommend.
//
// The live database had `llm_quota_subject_type_check` limited to
// ('user','capability'), while anonymous recommendations record a
// `persona` subject. pg-mem did not have that legacy constraint, so the
// whole suite stayed green until a live sweep hit it. This test recreates
// the legacy constraint, proves it rejects 'persona', then applies the
// shipped migration and proves the same insert now succeeds.

const MIGRATION = new URL('../migrations/006_llm_quota_persona.sql', import.meta.url);

const statements = () =>
  readFileSync(MIGRATION, 'utf-8')
    .replace(/--.*$/gm, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

describe('llm_quota subject_type constraint', () => {
  it('accepts persona subjects after the reconciliation migration', async () => {
    const pool = await getPool();

    // Put the database back into the state production was in.
    await pool.query('ALTER TABLE llm_quota DROP CONSTRAINT IF EXISTS llm_quota_subject_type_check');
    await pool.query(
      "ALTER TABLE llm_quota ADD CONSTRAINT llm_quota_subject_type_check CHECK (subject_type IN ('user', 'capability'))"
    );

    const subject = `persona-${Date.now()}`;
    await expect(checkAndIncrementQuota(subject, 'persona')).rejects.toThrow(/subject_type_check/);

    for (const statement of statements()) {
      await pool.query(statement);
    }

    const result = await checkAndIncrementQuota(subject, 'persona');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });
});
