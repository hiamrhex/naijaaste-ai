import { defineConfig, devices } from '@playwright/test';

// Visual + layout regression suite. Separate from tests/e2e so the fast
// functional suite does not pay for screenshot stabilisation.
//
//   npm run test:visual         compare against the committed baselines
//   npm run test:visual:update  regenerate baselines for THIS platform
//
// Baselines are per-platform (font rasterisation differs between Windows and
// Linux), so they live under __screenshots__/{platform}/. A platform without a
// baseline skips the pixel comparison but still runs the geometry assertions,
// which are platform-independent.
const API_PORT = Number(process.env.PW_API_PORT || 3000);
const WEB_PORT = Number(process.env.PW_WEB_PORT || 5173);
const API_ORIGIN = `http://localhost:${API_PORT}`;

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  expect: {
    timeout: 20000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.01,
    },
  },
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{arg}{ext}',
  use: {
    baseURL: process.env.BASE_URL || `http://localhost:${WEB_PORT}`,
    viewport: { width: 1440, height: 900 },
    // Deterministic marketing page: the demo chat renders in its final state
    // instead of replaying the scripted setTimeout loop.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
  },
  projects: [
    {
      name: 'visual',
      use: {
        ...devices['Desktop Chrome'],
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
        DATABASE_URL: '',
        DATABASE_URL_DIRECT: '',
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      port: WEB_PORT,
      reuseExistingServer: true,
      env: {
        ...process.env,
        VITE_API_URL: API_ORIGIN,
        VITE_API_PROXY: API_ORIGIN,
      },
    },
  ],
});
