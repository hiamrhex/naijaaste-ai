import { test, expect } from '@playwright/test';

// Frontend contract for a platform-killed API: the body is plain text, not
// JSON. The user must see a friendly message with the request id and a retry
// button — never a raw parser error like "Unexpected token 'A'".
//
// The API is stubbed at the network layer, so this spec never needs a Gemini
// key and proves the client behaviour deterministically.
test('a plain-text server error shows a friendly message with the request id and a retry button', async ({ page }) => {
  let calls = 0;

  // The SPA talks to the API at /agent in dev (absolute dev origin) and
  // /api/agent in production — match both.
  await page.route(/\/agent(\?|$)/, async (route) => {
    calls += 1;
    if (calls === 1) {
      // What Vercel returns when it kills a function: plain text, 500.
      await route.fulfill({
        status: 500,
        contentType: 'text/plain; charset=utf-8',
        headers: {
          'x-request-id': 'req-live-4242',
          // The stub replaces the API response entirely, so it must also
          // stand in for the server's CORS expose-headers (same-origin in
          // production, but the dev origin is cross-origin).
          'access-control-expose-headers': 'x-request-id',
        },
        body: 'An error occurred with your deployment. FUNCTION_INVOCATION_TIMEOUT',
      });
      return;
    }
    // Second attempt succeeds, proving the retry button really retries.
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'x-request-id': 'req-live-4243' },
      body: JSON.stringify({
        success: true,
        session_id: '11111111-1111-4111-8111-111111111111',
        stage: 'gather',
        message: 'Retry worked — here are your spots.',
        recommendations: null,
        meta: { latency_ms: 12, steps: 1, agent: true },
      }),
    });
  });

  // Sign in through the API so the chat screen is reachable.
  await page.goto('/app/signup');
  await expect(page.getByRole('button', { name: /create account/i }).first()).toBeVisible({ timeout: 15000 });

  const email = `err${Date.now()}@example.com`;
  await page.getByPlaceholder(/ada obi/i).fill('Error Probe');
  await page.getByPlaceholder(/you@example\.com/i).fill(email);
  await page.getByPlaceholder(/at least 8 characters/i).fill('Str0ng!Passw0rd!');
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByRole('navigation', { name: /main sections/i })).toBeVisible({ timeout: 15000 });

  await page.getByPlaceholder(/describe yourself/i).fill('Where can I eat jollof in Lagos?');
  await page.getByRole('button', { name: /send message/i }).click();

  // Friendly message + the request id from the response header.
  const bubble = page.locator('[role="log"]').getByText(/server had a problem/i);
  await expect(bubble).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[role="log"]').getByText(/req-live-4242/i)).toBeVisible({ timeout: 15000 });

  // The raw platform body and the parser error must never reach the UI.
  await expect(page.getByText(/Unexpected token/i)).toHaveCount(0);
  await expect(page.getByText(/FUNCTION_INVOCATION_TIMEOUT/)).toHaveCount(0);

  // A retry button that actually retries.
  const retry = page.getByRole('button', { name: /try again/i });
  await expect(retry).toBeVisible({ timeout: 15000 });
  await retry.click();
  await expect(page.locator('[role="log"]').getByText(/retry worked/i)).toBeVisible({ timeout: 15000 });
  expect(calls).toBe(2);
});
