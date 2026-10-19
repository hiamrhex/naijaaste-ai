import { test, expect } from '@playwright/test';

// Mobile-viewport smoke: signup → nearby → save favorite → saved wishlist → sign out.
// No LLM calls (CI has no Gemini key): exercises auth, geo, favorites, saved_places, session.
test.use({
  geolocation: { latitude: 6.5095, longitude: 3.3711 },
  permissions: ['geolocation'],
});

test('signup, nearby, save, saved wishlist, sign out', async ({ page }) => {
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

  // Nearby via the Map tab (geolocation stubbed to Yaba, Lagos at context creation).
  await page.getByRole('link', { name: /^map$/i }).click();
  const nearMe = page.getByRole('button', { name: /near me/i });
  await expect(nearMe).toBeEnabled({ timeout: 15000 });
  await nearMe.click();
  // Either populated cards or the honest empty state (geolocation is stubbed,
  // but live data varies) — both prove the flow completed.
  await expect(page.locator('[role="listitem"], :text("No spots within")').first()).toBeVisible({ timeout: 20000 });

  // Save the first spot if any appeared.
  const saveBtn = page.getByRole('button', { name: /save spot/i }).first();
  if (await saveBtn.count()) {
    await saveBtn.click();
  }

  // Saved wishlist: save-by-name appears in Fits/Might-fit the same session.
  await page.getByRole('link', { name: /^saved$/i }).click();
  await expect(page.getByPlaceholder(/save a spot/i)).toBeVisible({ timeout: 15000 });
  await page.getByPlaceholder(/save a spot/i).fill(`E2E Buka ${stamp}`);
  await page.getByRole('button', { name: /^save spot$/i }).click();
  await expect(page.getByText(`E2E Buka ${stamp}`).first()).toBeVisible({ timeout: 15000 });

  // Delete-confirm dialog: dismiss keeps the spot, accept removes it.
  const trash = page.getByLabel(`Remove E2E Buka ${stamp} from saved spots`);
  await expect(trash).toBeVisible({ timeout: 15000 });

  let dismissedMessage = '';
  page.once('dialog', async (dialog) => {
    dismissedMessage = dialog.message();
    await dialog.dismiss();
  });
  await trash.click();
  await expect(trash).toBeVisible();
  expect(dismissedMessage).toContain(`E2E Buka ${stamp}`);

  let acceptedType = '';
  page.once('dialog', async (dialog) => {
    acceptedType = dialog.type();
    await dialog.accept();
  });
  await trash.click();
  await expect(trash).toHaveCount(0, { timeout: 15000 });
  expect(acceptedType).toBe('confirm');

  // Sign out from Settings (test id: the global header has its own sign-out).
  await page.getByRole('link', { name: /^settings$/i }).click();
  await page.getByTestId('settings-signout').click();
  await expect(page).toHaveURL(/\/app\/login/, { timeout: 15000 });
});
