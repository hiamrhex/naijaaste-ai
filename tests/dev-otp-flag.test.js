import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

// Plan 008: with DEV_OTP_ENABLED off, forgot-password stays generic (200)
// and never includes dev_otp — even for a known account.
const PREV = { DEV_OTP_ENABLED: process.env.DEV_OTP_ENABLED };

let app;

beforeAll(async () => {
  process.env.DEV_OTP_ENABLED = 'false';
  ({ app } = await import('../src/app.js'));
});

afterAll(() => {
  if (PREV.DEV_OTP_ENABLED === undefined) delete process.env.DEV_OTP_ENABLED;
  else process.env.DEV_OTP_ENABLED = PREV.DEV_OTP_ENABLED;
});

describe('dev_otp flag off (plan 008)', () => {
  it('known account gets the generic message with no dev_otp', async () => {
    const email = `flagoff${Date.now()}@example.com`;
    await request(app)
      .post('/auth/signup')
      .send({ name: 'Flag Off', email, password: 'Str0ng!Passw0rd' })
      .expect(201);
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email })
      .expect(200);
    expect(res.body.message).toMatch(/reset code has been sent/);
    expect(res.body).not.toHaveProperty('dev_otp');
  });
});
