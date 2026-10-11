import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      // Test defaults so the fail-fast env schema (src/env.js) passes in CI
      // where no .env exists. dotenv never overrides these.
      GEMINI_API_KEY: 'test-key-not-real',
      GEMINI_MODEL: 'gemini-3.8-flash',
      NODE_ENV: 'test',
      LOG_LEVEL: 'warn',
      JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef',
      JWT_REFRESH_SECRET: 'test-refresh-secret-fedcba9876543210',
    },
  },
});
