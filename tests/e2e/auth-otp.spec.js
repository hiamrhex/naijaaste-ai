import { test, expect } from '@playwright/test';

// Password-reset journey in the browser: signup → forgot password → enter the
// 6-digit code → set a new password → sign in with it.
//
// CI has no SMTP and no Gemini key, so the reset code comes back in the API
// response (dev_otp) and the UI renders it in the "Dev mode" panel. The test
// reads it from the DOM, which is exactly what a developer sees locally.
//
// Runs only where the code is surfaced; a production deployment never returns
// dev_otp and this spec skips itself.
test('forgot password: request code, reset, sign in with the new password', async ({ page }) => {
  await page.goto('/app/signup');
  await expect(page.getByRole('button', { name: /create account/i }).first()).toBeVisible({ timeout: 15000 });

  const stamp = Date.now();
  const email = `otp${stamp}@example.com`;
  await page.getByPlaceholder(/ada obi/i).fill('E2E Reset');
  await page.getByPlaceholder(/you@example\.com/i).fill(email);
  await page.getByPlaceholder(/at least 8 characters/i).fill('Str0ng!Passw0rd');
  await page.locator('form button[type="submit"]').click();

  await expect(page.getByRole('navigation', { name: /main sections/i })).toBeVisible({ timeout: 15000 });

  // Sign out, then start the reset from the sign-in screen.
  await page.getByRole('link', { name: /^settings$/i }).click();
  await page.getByTestId('settings-signout').click();
  await expect(page).toHaveURL(/\/app\/login/, { timeout: 15000 });

  await page.getByRole('button', { name: /forgot password/i }).click();
  await page.getByPlaceholder(/you@example\.com/i).fill(email);
  await page.getByRole('button', { name: /send reset code/i }).click();

  // The code panel only exists when the server surfaces the code (dev mode).
  const devCode = page.getByTestId('dev-otp');
  const visible = await devCode
    .waitFor({ state: 'visible', timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  test.skip(!visible, 'server does not surface dev_otp (production-like env)');

  const code = (await devCode.innerText()).replace(/\D/g, '');
  expect(code).toMatch(/^\d{6}$/);

  await page.getByPlaceholder(/000000/i).fill(code);
  await page.getByPlaceholder(/at least 8 characters/i).fill('N3wPassw0rd!');
  await page.getByRole('button', { name: /reset password/i }).click();

  // The reset lands on sign-in with a confirmation.
  await expect(page.getByText(/password updated/i)).toBeVisible({ timeout: 15000 });

  await page.getByPlaceholder(/you@example\.com/i).fill(email);
  await page.getByPlaceholder(/••••••••/i).fill('N3wPassw0rd!');
  // The tab strip also has a "Sign in" button — target the form's submit.
  await page.locator('form button[type="submit"]').click();

  // Wait longer for navigation to appear after password reset
  await expect(page.getByRole('navigation', { name: /main sections/i })).toBeVisible({ timeout: 30000 });
});
