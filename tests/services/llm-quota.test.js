import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// hoisted runs before the module graph is imported, so the quota service
// picks up this limit instead of the default 100. 10 makes the 70% threshold
// land on call 7, which keeps the test short.
vi.hoisted(() => {
  process.env.LLM_MONTHLY_MAX = '10';
});

const { checkAndIncrementQuota, getQuotaStatus } = await import(
  '../../src/services/llm-quota.service.js'
);
const { getPool } = await import('../../src/db/pool.js');

const LIMIT = 10;
const THRESHOLD = Math.ceil(LIMIT * 0.7); // 7

let subject;

beforeAll(async () => {
  // Force the pool/migrations to initialise before the first assertion.
  await getPool();
});

beforeEach(() => {
  subject = `quota-${Date.now()}-${Math.random().toString(36).slice(2)}`;
});

const call = () => checkAndIncrementQuota(subject, 'user');

describe('checkAndIncrementQuota', () => {
  it('starts at zero and counts up per subject', async () => {
    const first = await call();
    expect(first).toMatchObject({ allowed: true, remaining: LIMIT - 1, limit: LIMIT });
    expect(first.warned).toBe(false);

    const second = await call();
    expect(second.remaining).toBe(LIMIT - 2);
  });

  it('flags the 70% threshold exactly once', async () => {
    let result;
    for (let i = 1; i <= THRESHOLD; i += 1) {
      result = await call();
    }

    expect(result.allowed).toBe(true);
    expect(result.warned).toBe(true);
    expect(result.remaining).toBe(LIMIT - THRESHOLD);
  });

  it('does not reset the warning flag on the following call', async () => {
    for (let i = 1; i <= THRESHOLD; i += 1) await call();

    const afterThreshold = await call();
    const later = await call();

    expect(afterThreshold.warned).toBe(false);
    expect(later.warned).toBe(false);
    // The bug flipped warned_at_70 back to false, so the next call re-warned.
    expect((await call()).warned).toBe(false);

    const pool = await getPool();
    const { rows } = await pool.query(
      'SELECT warned_at_70 FROM llm_quota WHERE subject_id = $1 AND subject_type = $2',
      [subject, 'user']
    );
    expect(rows[0].warned_at_70).toBe(true);
  });

  it('blocks once the limit is reached without consuming another call', async () => {
    for (let i = 1; i <= LIMIT; i += 1) await call();

    const blocked = await call();

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.limit).toBe(LIMIT);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.error).toMatch(/quota exceeded/i);

    const status = await getQuotaStatus(subject, 'user');
    expect(status.used).toBe(LIMIT);
    expect(status.remaining).toBe(0);
  });

  it('keeps user and capability quotas separate', async () => {
    const capability = `${subject}-anon`;

    await checkAndIncrementQuota(subject, 'user');
    await checkAndIncrementQuota(subject, 'user');
    await checkAndIncrementQuota(capability, 'capability');

    expect((await getQuotaStatus(subject, 'user')).used).toBe(2);
    expect((await getQuotaStatus(capability, 'capability')).used).toBe(1);
  });
});

describe('getQuotaStatus', () => {
  it('reports a fresh subject as unused', async () => {
    expect(await getQuotaStatus(subject, 'user')).toEqual({
      limit: LIMIT,
      used: 0,
      remaining: LIMIT,
    });
  });

  it('never reports a negative remaining balance', async () => {
    for (let i = 0; i <= LIMIT; i += 1) await call();

    const status = await getQuotaStatus(subject, 'user');

    expect(status.used).toBe(LIMIT);
    expect(status.remaining).toBe(0);
  });
});
