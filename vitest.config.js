import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['node_modules', 'dist', 'tests/e2e/**'],
    // Integration-style suite (bcrypt + per-file pg-mem init); generous
    // timeouts so parallel CI load causes retries, not flakes.
    testTimeout: 30000,
    hookTimeout: 60000,
    env: {
      // Test defaults so the fail-fast env schema (src/env.js) passes in CI
      // where no .env exists. dotenv never overrides these.
      GEMINI_API_KEY: 'test-key-not-real',
      GEMINI_MODEL: 'gemini-3.5-flash-lite',
      NODE_ENV: 'test',
      LOG_LEVEL: 'warn',
      JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef',
      JWT_REFRESH_SECRET: 'test-refresh-secret-fedcba9876543210',
      DEV_OTP_ENABLED: 'true',
      // Tests run against in-process pg-mem, exactly like CI. Without this a
      // developer's local .env leaks DATABASE_URL into the suite, and the
      // tests then create accounts in the live database and depend on a
      // pooled connection that can be reset mid-run.
      DATABASE_URL: '',
      DATABASE_URL_DIRECT: '',
      // The suite exercises the auth flows far more than a real user would in
      // a 15-minute window; the limiter itself is covered separately in
      // tests/auth-limits.test.js with a deliberately tiny budget.
      AUTH_RATE_LIMIT_SIGNUP_MAX: '500',
      AUTH_RATE_LIMIT_SIGNIN_MAX: '500',
      AUTH_RATE_LIMIT_REFRESH_MAX: '500',
      AUTH_RATE_LIMIT_FORGOT_MAX: '500',
      AUTH_RATE_LIMIT_RESET_MAX: '500',
    },
  },
});
