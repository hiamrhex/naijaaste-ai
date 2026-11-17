import request from 'supertest';

// A verified session for tests that are *not* about email verification.
// Phase 0.1 made a proven mailbox a precondition for a session, so "sign up and
// use the token" became two steps. This helper is that two-step, in one place.
//
// The app is passed in, not imported: several suites set rate-limit env vars in
// beforeAll and only then `await import('../src/app.js')`. A static import here
// would load the app before those vars exist and silently change the limits.
export const PASSWORD = 'Str0ng!Passw0rd';

export const signupVerified = async (app, email, { password = PASSWORD, name = 'Verified Tester' } = {}) => {
  const created = await request(app).post('/auth/signup').send({ name, email, password });
  if (created.status !== 201) {
    throw new Error(`signup failed for ${email}: ${created.status} ${JSON.stringify(created.body)}`);
  }
  const otp = created.body.dev_otp;
  if (!otp) {
    throw new Error('dev_otp missing — tests need DEV_OTP_ENABLED=true, NODE_ENV!=production and no SMTP configured');
  }
  const verified = await request(app).post('/auth/verify-email').send({ email, otp });
  if (verified.status !== 200) {
    throw new Error(`verify failed for ${email}: ${verified.status} ${JSON.stringify(verified.body)}`);
  }
  const setCookie = verified.headers['set-cookie'] || [];
  return {
    user: verified.body.user,
    accessToken: verified.body.accessToken,
    cookie: setCookie.find((c) => c.startsWith('refreshToken=')) || '',
    setCookie,
  };
};

// Most suites only need the bearer token.
export const verifiedToken = async (app, email, options) => (await signupVerified(app, email, options)).accessToken;
