import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    env: {
      // Dummy so the eager Groq client constructor at src/services/llm.service.js:3
      // succeeds in tests. Never a real key; no test performs an LLM call.
      GROQ_API_KEY: 'test-key-not-a-real-secret',
      NODE_ENV: 'test',
    },
  },
});
