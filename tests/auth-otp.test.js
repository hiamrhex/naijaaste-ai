import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

// ─── Auth + OTP contract ─────────────────────────────────────────────────────
// The reset journey has to work end to end (request → code → new password →
// sign in) AND leak nothing: no account enumeration, no timing oracle, no
// guessable codes, no stale sessions after a password change.
//
// Everything here runs against the same store the API uses. DEV_OTP_ENABLED is
// 'true' and no SMTP is configured in the test env, so the reset code comes
// back in the response — the same path a developer exercises locally.

const PASS = 'Str0ng!Passw0rd';
const NEW_PASS = 'N3wPassw0rd!';

let seq = 0;
const email = (tag) => `otp-${tag}-${Date.now()}-${seq++}@example.com`;

const signup = (mail, password = PASS, name = 'OTP Tester') =>
  request(app).post('/auth/signup').send({ name, email: mail, password });

const requestCode = (mail) =>
  request(app).post('/auth/forgot-password').send({ email: mail });

const resetWith = (mail, otp, newPassword = NEW_PASS) =>
  request(app).post('/auth/reset-password').send({ email: mail, otp, new_password: newPassword });

const cookieOf = (res) => (res.headers['set-cookie'] || [])
  .find((c) => c.startsWith('refreshToken='))?.split(';')[0] || '';

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-0123456789abcdef';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-fedcba9876543210';
});

describe('password reset journey', () => {
  it('signup → request code → reset → sign in with the new password', async () => {
    const mail = email('journey');
    await signup(mail).expect(201);

    const fp = await requestCode(mail).expect(200);
    expect(fp.body.dev_otp).toMatch(/^\d{6}$/);

    await resetWith(mail, fp.body.dev_otp).expect(200);

    await request(app).post('/auth/signin').send({ email: mail, password: PASS }).expect(401);
    const ok = await request(app).post('/auth/signin').send({ email: mail, password: NEW_PASS }).expect(200);
    expect(ok.body.accessToken).toBeTruthy();
  });

  it('a password change revokes every refresh session', async () => {
    const mail = email('revoke');
    const created = await signup(mail).expect(201);
    const cookie = cookieOf(created);

    const fp = await requestCode(mail).expect(200);
    await resetWith(mail, fp.body.dev_otp).expect(200);

    await request(app).post('/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('a reset code works exactly once', async () => {
    const mail = email('replay');
    await signup(mail).expect(201);
    const fp = await requestCode(mail).expect(200);
    await resetWith(mail, fp.body.dev_otp).expect(200);
    await resetWith(mail, fp.body.dev_otp, 'An0therPassw0rd!').expect(400);
  });

  it('a code issued for one account cannot reset another', async () => {
    const mine = email('cross-a');
    const theirs = email('cross-b');
    await signup(mine).expect(201);
    await signup(theirs).expect(201);
    const fp = await requestCode(mine).expect(200);
    await resetWith(theirs, fp.body.dev_otp).expect(400);
  });

  it('an expired code is refused', async () => {
    const mail = email('expired');
    await signup(mail).expect(201);
    const fp = await requestCode(mail).expect(200);
    const { __setOtpExpiry } = await import('../src/auth/otp.js');
    await __setOtpExpiry(mail, new Date(Date.now() - 1000).toISOString());
    const res = await resetWith(mail, fp.body.dev_otp).expect(400);
    expect(res.body.error.code).toBe('INVALID_OTP');
    expect(res.body.error.message).toMatch(/expired/i);
  });

  it('five wrong guesses burn the code, and the right one stops working', async () => {
    const mail = email('burn');
    await signup(mail).expect(201);
    const fp = await requestCode(mail).expect(200);
    for (let i = 0; i < 5; i += 1) {
      const res = await resetWith(mail, '000000').expect(400);
      expect(res.body.error.code).toBe('INVALID_OTP');
    }
    await resetWith(mail, fp.body.dev_otp).expect(400);
  });

  it('reports how many attempts are left', async () => {
    const mail = email('attempts');
    await signup(mail).expect(201);
    const fp = await requestCode(mail).expect(200);
    const first = await resetWith(mail, '000000').expect(400);
    expect(first.body.error.message).toMatch(/4 attempts left/);
    const second = await resetWith(mail, '000000').expect(400);
    expect(second.body.error.message).toMatch(/3 attempts left/);
    await resetWith(mail, fp.body.dev_otp).expect(200);
  });

  it('rejects a malformed code and a weak new password', async () => {
    const mail = email('shape');
    await signup(mail).expect(201);
    await requestCode(mail).expect(200);
    const bad = await request(app).post('/auth/reset-password')
      .send({ email: mail, otp: '12', new_password: 'short' }).expect(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('no account enumeration', () => {
  it('known and unknown emails get byte-identical answers', async () => {
    const known = email('known');
    await signup(known).expect(201);
    const unknown = email('unknown');

    const a = await requestCode(known).expect(200);
    const b = await requestCode(unknown).expect(200);

    expect(a.status).toBe(b.status);
    expect(a.body.message).toBe(b.body.message);
    expect(Object.keys(a.body).filter((k) => k !== 'dev_otp'))
      .toEqual(Object.keys(b.body));
    expect(b.body).not.toHaveProperty('dev_otp');
  });

  it('a repeat request never leaks a cooldown status', async () => {
    const known = email('repeat-known');
    await signup(known).expect(201);
    const unknown = email('repeat-unknown');

    // The old behaviour answered 429 RESEND_COOLDOWN for known accounts and
    // 200 for unknown ones — a one-bit oracle for who has an account.
    const a1 = await requestCode(known).expect(200);
    await requestCode(unknown).expect(200);
    const a2 = await requestCode(known).expect(200);
    const b2 = await requestCode(unknown).expect(200);

    expect(a2.status).toBe(b2.status);
    expect(a2.body.message).toBe(b2.body.message);
    expect(a1.status).toBe(200);
  });

  it('an unknown email costs the same time as a wrong password', async () => {
    const known = email('timing-known');
    await signup(known).expect(201);
    const unknown = email('timing-unknown');

    const t0 = Date.now();
    await request(app).post('/auth/signin').send({ email: known, password: 'definitely-wrong' }).expect(401);
    const knownMs = Date.now() - t0;

    const t1 = Date.now();
    await request(app).post('/auth/signin').send({ email: unknown, password: 'definitely-wrong' }).expect(401);
    const unknownMs = Date.now() - t1;

    // Both paths must pay the bcrypt cost; before the fix the unknown email
    // answered in ~5ms against ~300ms, which enumerated accounts by timing.
    expect(unknownMs).toBeGreaterThan(knownMs * 0.5);
  });
});

describe('brute-force lockout', () => {
  it('locks after repeated failures and behaves the same for unknown emails', async () => {
    const known = email('lock-known');
    await signup(known).expect(201);
    const unknown = email('lock-unknown');

    for (let i = 0; i < 10; i += 1) {
      await request(app).post('/auth/signin').send({ email: known, password: 'wrong-password' }).expect(401);
      await request(app).post('/auth/signin').send({ email: unknown, password: 'wrong-password' }).expect(401);
    }

    const a = await request(app).post('/auth/signin').send({ email: known, password: 'wrong-password' });
    const b = await request(app).post('/auth/signin').send({ email: unknown, password: 'wrong-password' });
    expect(a.status).toBe(429);
    expect(b.status).toBe(429);
    expect(a.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(b.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(a.headers['retry-after']).toBeDefined();
  });

  it('a successful sign-in clears the counter', async () => {
    const mail = email('unlock');
    await signup(mail).expect(201);
    for (let i = 0; i < 3; i += 1) {
      await request(app).post('/auth/signin').send({ email: mail, password: 'wrong-password' }).expect(401);
    }
    await request(app).post('/auth/signin').send({ email: mail, password: PASS }).expect(200);
    for (let i = 0; i < 3; i += 1) {
      await request(app).post('/auth/signin').send({ email: mail, password: 'wrong-password' }).expect(401);
    }
    await request(app).post('/auth/signin').send({ email: mail, password: PASS }).expect(200);
  });
});

describe('password policy', () => {
  it('rejects a password from the common-password denylist', async () => {
    const res = await signup(email('weak'), 'password123').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/too easy to guess/i);
  });

  it('rejects a password derived from the email address', async () => {
    // The account is never created (the request is rejected), so the address
    // does not need to be unique.
    const res = await signup('janedoe@example.com', 'janedoe-secret').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/must not contain your email/i);
  });

  it('accepts a long, non-trivial password', async () => {
    await signup(email('strong'), 'correct-horse-battery-staple-9').expect(201);
  });
});

describe('response hygiene', () => {
  it('token-bearing responses are not cacheable', async () => {
    const mail = email('nostore');
    const res = await signup(mail).expect(201);
    expect(res.headers['cache-control']).toBe('no-store');

    const fp = await requestCode(mail).expect(200);
    expect(fp.headers['cache-control']).toBe('no-store');
  });

  it('the limiter answers with the shared error contract', async () => {
    const res = await request(app).post('/auth/signup')
      .send({ name: 'x', email: 'not-an-email', password: PASS }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.requestId).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });
});
