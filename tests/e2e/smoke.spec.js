import { test, expect } from '@playwright/test';

// Mobile-viewport smoke: signup → nearby → save favorite → sign out.
// No LLM calls (CI has no Gemini key): exercises auth, geo, favorites, session.
test('signup, nearby, save, sign out', async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e${stamp}@example.com`;

  await page.goto('/app/signup');
  await expect(page.getByRole('button', { name: /create account/i }).first()).toBeVisible({ timeout: 15000 });

  await page.getByPlaceholder(/ada obi/i).fill('E2E User');
  await page.getByPlaceholder(/you@example\.com/i).fill(email);
  await page.getByPlaceholder(/at least 8 characters/i).fill('Str0ng!Passw0rd');
  await page.locator('form button[type="submit"]').click();

  // Lands in the app after signup (auth gate gone, tabs visible).
  await expect(page.getByRole('navigation', { name: /main sections/i })).toBeVisible({ timeout: 15000 });

  // Nearby via the Map tab (geolocation stubbed to Yaba, Lagos).
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 6.5095, longitude: 3.3711 });
  await page.getByRole('link', { name: /^map$/i }).click();
  await page.getByRole('button', { name: /near me/i }).click();
  // Either populated cards or the honest empty state (geolocation is stubbed,
  // but live data varies) — both prove the flow completed.
  await expect(page.locator('[role="listitem"], :text("No spots within")').first()).toBeVisible({ timeout: 20000 });

  // Save the first spot if any appeared.
  const saveBtn = page.getByRole('button', { name: /save spot/i }).first();
  if (await saveBtn.count()) {
    await saveBtn.click();
  }

  // Sign out from Settings.
  await page.getByRole('link', { name: /^settings$/i }).click();
  await page.getByRole('button', { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/app\/login/, { timeout: 15000 });
});
