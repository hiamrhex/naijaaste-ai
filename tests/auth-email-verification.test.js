import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createUser, upsertGoogleUser } from '../src/auth/store.js';
import { signAccessToken } from '../src/auth/tokens.js';
import bcrypt from 'bcrypt';

// ─── Phase 0.1: email ownership is a precondition for a session ─────────────
// Each test names the attack or the regression it pins. They are written
// against the pre-fix code first, so every one of them fails for a stated
// reason before migration 010 exists.

const PASS = 'Str0ng!Passw0rd';
let seq = 0;
const email = (tag) => `verify-${tag}-${Date.now()}-${seq++}@example.com`;

const signup = (mail, password = PASS) =>
  request(app).post('/auth/signup').send({ name: 'Verify Tester', email: mail, password });

const verify = (mail, otp) =>
  request(app).post('/auth/verify-email').send({ email: mail, otp });

const cookieOf = (res) => (res.headers['set-cookie'] || [])
  .find((c) => c.startsWith('refreshToken='));

describe('signup does not mint a session before the mailbox is proven', () => {
  it('(a) signup returns no access token and no refresh cookie', async () => {
    const res = await signup(email('notokens')).expect(201);
    expect(res.body.accessToken).toBeUndefined();
    expect(cookieOf(res)).toBeUndefined();
    expect(res.body.user.email_verified).toBe(false);
    expect(res.body.dev_otp).toMatch(/^\d{6}$/);
  });

  it('(b) a token minted before 0.1 is refused with 403 for an unverified user', async () => {
    const mail = email('legacy');
    const user = await createUser({ email: mail, passwordHash: await bcrypt.hash(PASS, 4), name: 'Legacy' });
    const stale = signAccessToken(user);

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${stale}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('(c) the signup code verifies the address and mints tokens', async () => {
    const mail = email('happy');
    const created = await signup(mail).expect(201);

    const ok = await verify(mail, created.body.dev_otp).expect(200);
    expect(typeof ok.body.accessToken).toBe('string');
    expect(cookieOf(ok)).toBeDefined();
    expect(ok.body.user.email_verified).toBe(true);

    const me = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${ok.body.accessToken}`)
      .expect(200);
    expect(me.body.user.email).toBe(mail);
  });

  it('(d) five wrong codes consume the code; the sixth correct one is refused', async () => {
    const mail = email('brute');
    const created = await signup(mail).expect(201);

    let last;
    for (let i = 0; i < 5; i++) {
      last = await verify(mail, '000000');
      expect(last.status).toBe(400);
    }
    // The fifth attempt is the one that reports the burn...
    expect(last.body.error.message).toMatch(/too many attempts/i);
    // ...and the code is gone, so even the correct one cannot resurrect it.
    const after = await verify(mail, created.body.dev_otp);
    expect(after.status).toBe(400);
    expect(after.body.error.code).toBe('INVALID_OTP');
  });

  it('(e) a signup code cannot be spent at /auth/reset-password', async () => {
    const mail = email('cross');
    const created = await signup(mail).expect(201);

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ email: mail, otp: created.body.dev_otp, new_password: 'An0therPassw0rd!' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_OTP');
  });

  it('(f) re-signup on an unverified address overwrites it, so a squatter cannot hold it', async () => {
    const mail = email('squat');
    await signup(mail, 'AttackerPass1!').expect(201);

    // The real owner retries with their own password: no 409, the squatter's
    // password is replaced, and the new code is the only live one.
    const second = await signup(mail, PASS).expect(201);
    expect(second.body.dev_otp).toMatch(/^\d{6}$/);

    await request(app).post('/auth/signin').send({ email: mail, password: 'AttackerPass1!' }).expect(401);
    await verify(mail, second.body.dev_otp).expect(200);
    await request(app).post('/auth/signin').send({ email: mail, password: PASS }).expect(200);
  });

  it('(g) Google users are verified without an OTP round trip', async () => {
    const mail = email('google');
    const { user } = await upsertGoogleUser({ email: mail, name: 'G User', picture: null, sub: `g-${seq}` });
    expect(user.email_verified).toBe(true);

    const me = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${signAccessToken(user)}`)
      .expect(200);
    expect(me.body.user.email).toBe(mail);
  });
});
