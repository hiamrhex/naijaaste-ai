import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 1,
  use: {
    baseURL: 'http://127.0.0.1:5173',
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
      // Vite dev (not preview): the spa-app-fallback plugin serves the SPA
      // shell for /app/* exactly like the Vercel rewrites do in prod.
      command: 'npx vite --port 5173 --strictPort',
      port: 5173,
      reuseExistingServer: true,
    },
  ],
});
