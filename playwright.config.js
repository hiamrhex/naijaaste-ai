import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'node src/server.js',
      port: 3000,
      reuseExistingServer: true,
      env: { ...process.env, NODE_ENV: 'test' },
    },
    {
      command: 'npx vite preview --port 4173 --strictPort',
      port: 4173,
      reuseExistingServer: true,
    },
  ],
});
