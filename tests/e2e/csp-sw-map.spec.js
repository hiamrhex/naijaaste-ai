import { test, expect } from '@playwright/test';

// The strict CSP (script-src 'self', no 'unsafe-inline') is applied to every
// document Vercel serves. Two things depend on it still working:
//
//   1. the service worker (registers, activates, serves the precached shell)
//   2. the Leaflet map (bundled JS + OSM tile images)
//
// The map tiles come from tile.openstreetmap.org, so the policy must allow
// https: images — and the map must actually paint tiles.
//
// The service worker only exists in the production build, so the SW checks
// run against the dist preview (port 4173) rather than the Vite dev server.

const DIST = 'http://localhost:4173';

test.use({
  geolocation: { latitude: 6.5095, longitude: 3.3711 },
  permissions: ['geolocation'],
});

test('the service worker registers and the offline page is reachable', async ({ page }) => {
  await page.goto(`${DIST}/app/login`);

  // The service worker registers for the /app scope.
  await expect
    .poll(async () => {
      const regs = await page.evaluate(async () => {
        const list = await navigator.serviceWorker.getRegistrations();
        return list.map((r) => r.scope);
      });
      return regs;
    }, { timeout: 20000 })
    .not.toEqual([]);

  const registrations = await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.map((r) => ({ scope: r.scope, active: !!r.active }));
  });
  expect(registrations.length).toBeGreaterThan(0);
  // registerSW.js registers /sw.js with the root scope.
  expect(registrations[0].scope).toContain('4173/');

  // The offline page is served and its script is an external file (a strict
  // script-src forbids an inline script).
  const offline = await page.goto(`${DIST}/offline.html`);
  expect(offline?.status()).toBe(200);
  const hasInlineScript = await page.evaluate(
    () => !!document.querySelector('script:not([src])')
  );
  expect(hasInlineScript).toBe(false);
  expect(await page.getByRole('link', { name: /try again/i }).count()).toBeGreaterThan(0);
});

test('the Leaflet map renders and loads OSM tiles', async ({ page }) => {
  const tileRequests = [];
  page.on('request', (req) => {
    if (req.url().includes('tile.openstreetmap.org')) tileRequests.push(req.url());
  });

  await page.goto('/app/signup');
  const email = `map${Date.now()}@example.com`;
  await page.getByPlaceholder(/ada obi/i).fill('Map Probe');
  await page.getByPlaceholder(/you@example\.com/i).fill(email);
  await page.getByPlaceholder(/at least 8 characters/i).fill('Str0ng!Passw0rd!');
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByRole('navigation', { name: /main sections/i })).toBeVisible({ timeout: 15000 });

  await page.getByRole('link', { name: /^map$/i }).click();
  await expect(page.getByRole('button', { name: /near me/i })).toBeEnabled({ timeout: 15000 });
  await page.getByRole('button', { name: /near me/i }).click();

  // Leaflet mounted: the container and its tile pane exist.
  const container = page.locator('.leaflet-container');
  await expect(container).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.leaflet-tile-pane')).toHaveCount(1, { timeout: 20000 });

  // Tiles were actually requested from the OSM tile server (the policy
  // allows https: images, and the map asks for them).
  await expect
    .poll(() => tileRequests.length, { timeout: 20000 })
    .toBeGreaterThan(0);

  // The attribution Leaflet renders for the tile source.
  await expect(page.locator('.leaflet-control-attribution')).toContainText('OpenStreetMap', { timeout: 15000 });
});
