import { defineConfig, devices } from '@playwright/test';

// Ports are overridable so the suite can run on a machine where another
// project already owns 3000/5173. CI keeps the defaults.
//   PowerShell: $env:PW_API_PORT='3001'; npx playwright test
const API_PORT = Number(process.env.PW_API_PORT || 3000);
const WEB_PORT = Number(process.env.PW_WEB_PORT || 5173);
const DIST_PORT = Number(process.env.PW_DIST_PORT || 4173);
const API_ORIGIN = `http://localhost:${API_PORT}`;

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
    baseURL: process.env.BASE_URL || `http://localhost:${WEB_PORT}`,
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
      port: API_PORT,
      reuseExistingServer: true,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(API_PORT),
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
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      port: WEB_PORT,
      reuseExistingServer: true,
      env: {
        ...process.env,
        // src/constants/index.js calls the API directly in dev, and
        // vite.config.js proxies /api. Point both at the port chosen above
        // instead of their hardcoded 3000 defaults.
        VITE_API_URL: API_ORIGIN,
        VITE_API_PROXY: API_ORIGIN,
      },
    },
    {
      // The production build, served with the same rewrites Vercel applies.
      // Vite's dev server emits no service worker, so the service-worker
      // assertions need the real dist/ (see tests/e2e/csp-sw-map.spec.js).
      command: `node scripts/serve-dist.mjs ${DIST_PORT} ${API_ORIGIN}`,
      port: DIST_PORT,
      reuseExistingServer: true,
    },
  ],
});
