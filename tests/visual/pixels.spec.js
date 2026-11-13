import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

// Pixel baselines for the two static surfaces: the marketing page and the
// auth entry. Both render fully with reduced motion, so the only variable left
// is the platform's font rasterisation — hence the {platform} folder.
//
// If this platform has no baseline yet, skip with instructions instead of
// failing: a missing Linux baseline must not block a Windows developer (and
// vice versa). Generate with `npm run test:visual:update`.

const HERE = dirname(fileURLToPath(import.meta.url));
const baselineFor = (name) => join(HERE, '__screenshots__', process.platform, name);

const requireBaseline = (name) => {
  // `--update-snapshots` (or the default 'missing' mode) writes the baseline,
  // so only skip when comparisons are actually expected.
  if (test.info().config.updateSnapshots !== 'none') return;
  if (!existsSync(baselineFor(name))) {
    test.skip(true, `no ${process.platform} baseline for ${name} — run: npm run test:visual:update`);
  }
};

const settle = async (page) => {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts?.ready);
};

test('landing page matches its desktop baseline', async ({ page }) => {
  requireBaseline('landing-desktop.png');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await settle(page);

  await expect(page).toHaveScreenshot('landing-desktop.png');
});

test('landing page matches its mobile baseline', async ({ page }) => {
  requireBaseline('landing-mobile.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await settle(page);

  await expect(page).toHaveScreenshot('landing-mobile.png');
});

test('sign-in screen matches its desktop baseline', async ({ page }) => {
  requireBaseline('auth-desktop.png');
  await page.goto('/app/login');
  await expect(page.getByTestId('auth-card')).toBeVisible();
  await settle(page);

  await expect(page).toHaveScreenshot('auth-desktop.png');
});

test('sign-in screen matches its mobile baseline', async ({ page }) => {
  requireBaseline('auth-mobile.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/login');
  await expect(page.getByTestId('auth-card')).toBeVisible();
  await settle(page);

  await expect(page).toHaveScreenshot('auth-mobile.png');
});
