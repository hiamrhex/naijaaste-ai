import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 1,
  expect: {
    timeout: 20000, // Increased for CI flakiness
  },
  use: {
    // BASE_URL lets the same specs run against the deployment
    // (BASE_URL=https://naijataste-ai.vercel.app npx playwright test).
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        // Local runs without downloaded browsers: PW_CHANNEL=msedge.
        // CI leaves this unset (uses Playwright's bundled Chromium).
        ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
      },
    },
  ],
  webServer: [
    {
      command: 'node src/server.js',
      port: 3000,
      reuseExistingServer: true,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        // The e2e suite must never write to the production database: it
        // signs up, saves places and requests OTPs on every run. Point it at
        // the in-process pg-mem instead (the same choice the vitest suite
        // makes), so a test run cannot leave accounts in Neon.
        DATABASE_URL: '',
        DATABASE_URL_DIRECT: '',
      },
    },
    {
      // Vite dev (not preview): the spa-app-fallback plugin serves the SPA
      // shell for /app/* exactly like the Vercel rewrites do in prod.
      command: 'npx vite --port 5173 --strictPort',
      port: 5173,
      reuseExistingServer: true,
    },
    {
      // The production build, served with the same rewrites Vercel applies.
      // Vite's dev server emits no service worker, so the service-worker
      // assertions need the real dist/ (see tests/e2e/csp-sw-map.spec.js).
      command: 'node scripts/serve-dist.mjs 4173 http://localhost:3000',
      port: 4173,
      reuseExistingServer: true,
    },
  ],
});
