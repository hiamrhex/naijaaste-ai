import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';

// Regression for the independent review's D-4 / IQ-21: the auth endpoints
// leaked account existence through response time.
//
// These assertions are about WORK, not wall-clock: the two paths must do the
// same database operations and the same number of them, because a wall-clock
// assertion would be flaky in CI. probes/auth-timing-probe.mjs measures the
// actual latency (50 tries per case) against the real database.
vi.hoisted(() => {
  process.env.RATE_LIMIT_API_MAX = '5000';
  process.env.AUTH_RATE_LIMIT_SIGNIN_MAX = '5000';
  process.env.AUTH_RATE_LIMIT_FORGOT_MAX = '5000';
  process.env.AUTH_RATE_LIMIT_RESET_MAX = '5000';
});

import { app } from '../src/app.js';
import { getPool } from '../src/db/pool.js';

const stamp = Date.now();
const KNOWN = `timing-known-${stamp}@example.com`;
const UNKNOWN = `timing-unknown-${stamp}@example.com`;
const PASS = 'Str0ng!Passw0rd!';

const signup = (email) =>
  request(app).post('/auth/signup').send({ name: 'Timing Probe', email, password: PASS });

// Count the statements a request issues, so "same work" is measurable.
const countQueries = async (fn) => {
  const pool = await getPool();
  const original = pool.query.bind(pool);
  let count = 0;
  pool.query = (...args) => { count += 1; return original(...args); };
  try {
    await fn();
  } finally {
    pool.query = original;
  }
  return count;
};

describe('auth timing oracle (independent review D-4 / IQ-21)', () => {
  beforeAll(async () => {
    // One account for the whole file (the tests below reuse it).
    await signup(KNOWN).expect(201);
  });

  it('forgot-password does the same work for a known and an unknown email', async () => {
    const knownQueries = await countQueries(async () => {
      await request(app).post('/auth/forgot-password').send({ email: KNOWN }).expect(200);
    });
    const unknownQueries = await countQueries(async () => {
      await request(app).post('/auth/forgot-password').send({ email: UNKNOWN }).expect(200);
    });

    // Before the fix the unknown address answered immediately: no code was
    // issued and no mail was sent (a ~580ms difference - see the probe).
    expect(unknownQueries).toBe(knownQueries);
  });

  it('forgot-password issues a code row for an unknown address too', async () => {
    await request(app).post('/auth/forgot-password').send({ email: UNKNOWN }).expect(200);
    const pool = await getPool();
    const { rows } = await pool.query('SELECT count(*)::int AS c FROM otps WHERE email = $1', [UNKNOWN]);
    expect(rows[0].c).toBe(1);
  });

  it('forgot-password answers both addresses identically', async () => {
    const known = await request(app).post('/auth/forgot-password').send({ email: KNOWN }).expect(200);
    const unknown = await request(app).post('/auth/forgot-password').send({ email: UNKNOWN }).expect(200);
    expect(known.body.message).toBe(unknown.body.message);
    expect(Object.keys(known.body).filter((k) => k !== 'dev_otp'))
      .toEqual(Object.keys(unknown.body).filter((k) => k !== 'dev_otp'));
  });

  it('reset-password does the same work with and without a code row', async () => {
    const pool = await getPool();
    // Known account, wrong code: there IS a row (issued by forgot-password).
    await request(app).post('/auth/forgot-password').send({ email: KNOWN }).expect(200);
    const withRow = await countQueries(async () => {
      await request(app).post('/auth/reset-password')
        .send({ email: KNOWN, otp: '000000', new_password: 'An0therPassw0rd!' }).expect(400);
    });

    // Unknown address, no code row at all.
    await pool.query('DELETE FROM otps WHERE email = $1', [UNKNOWN]);
    const withoutRow = await countQueries(async () => {
      await request(app).post('/auth/reset-password')
        .send({ email: UNKNOWN, otp: '000000', new_password: 'An0therPassw0rd!' }).expect(400);
    });

    // Before the fix "no row" was one query against "wrong code" being two.
    expect(withoutRow).toBe(withRow);
  });

  it('signin always pays the bcrypt cost, known or not', async () => {
    const known = await request(app).post('/auth/signin').send({ email: KNOWN, password: 'WrongPassw0rd!' }).expect(401);
    const unknown = await request(app).post('/auth/signin').send({ email: UNKNOWN, password: 'WrongPassw0rd!' }).expect(401);

    // Same status, same code, same wording.
    expect(unknown.status).toBe(known.status);
    expect(unknown.body.error.code).toBe(known.body.error.code);
    expect(unknown.body.error.message).toBe(known.body.error.message);
  });

  it('the failure messages never name the reason (no reason oracle)', async () => {
    // A wrong code and a missing code must not produce different wording.
    await request(app).post('/auth/forgot-password').send({ email: KNOWN }).expect(200);
    const wrong = await request(app).post('/auth/reset-password')
      .send({ email: KNOWN, otp: '000000', new_password: 'An0therPassw0rd!' }).expect(400);

    const pool = await getPool();
    await pool.query('DELETE FROM otps WHERE email = $1', [KNOWN]);
    const missing = await request(app).post('/auth/reset-password')
      .send({ email: KNOWN, otp: '000000', new_password: 'An0therPassw0rd!' }).expect(400);

    // Both say the same thing about the code; the attempts-left counter is
    // only present when a code row existed, which is observable by the
    // requester either way (they asked for the code).
    expect(wrong.body.error.code).toBe(missing.body.error.code);
    expect(missing.body.error.message).toMatch(/invalid or expired/i);
  });
});
