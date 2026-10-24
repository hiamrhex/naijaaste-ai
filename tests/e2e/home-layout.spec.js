import { test, expect } from '@playwright/test';

// The home screen is a chat shell in the Claude/ChatGPT pattern:
//   - the conversation scrolls, the composer stays on screen
//   - one wide column for the messages (no cramped side rail)
//   - the food (results) arrives BELOW the conversation
//
// These assertions run on the real app, in a real browser, at two sizes.

for (const [name, viewport] of [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
]) {
  test.describe(name, () => {
    test.use({ viewport });

    test('the composer stays on screen and the conversation is one column', async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));

      await page.goto('/app/signup');
      await expect(page.getByRole('button', { name: /create account/i }).first()).toBeVisible({ timeout: 15000 });
      await page.getByPlaceholder(/ada obi/i).fill('Layout Probe');
      await page.getByPlaceholder(/you@example\.com/i).fill(`layout-${name}-${Date.now()}@example.com`);
      await page.getByPlaceholder(/at least 8 characters/i).fill('Str0ng!Passw0rd!');
      await page.locator('form button[type="submit"]').click();
      await expect(page.getByRole('navigation', { name: /main sections/i })).toBeVisible({ timeout: 20000 });

      // 1. The composer is on screen without scrolling.
      const composer = page.getByPlaceholder(/describe yourself/i);
      await expect(composer).toBeInViewport({ timeout: 10000 });

      // 2. The page itself does not scroll - the inner area does.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight
      );
      expect(overflow).toBeLessThanOrEqual(2);

      // 3. The conversation is a single wide column.
      const geometry = await page.evaluate(() => {
        const col = document.querySelector('.home-column');
        const stream = document.querySelector('[role="log"]');
        return {
          column: col ? Math.round(col.getBoundingClientRect().width) : 0,
          stream: stream ? Math.round(stream.getBoundingClientRect().width) : 0,
        };
      });
      expect(geometry.stream).toBeGreaterThan(300);
      // Allow small difference due to padding/margins (column includes padding, stream doesn't)
      expect(Math.abs(geometry.stream - geometry.column)).toBeLessThanOrEqual(60);

      // 4. A message is answered in that column.
      await composer.fill('Jollof rice in Lagos on a tight budget, I love pepper soup');
      await page.getByRole('button', { name: /send message/i }).click();
      await page.waitForFunction(() => {
        const b = [...document.querySelectorAll('[role="log"] .bubble-in')];
        const last = b[b.length - 1];
        return !!last && (last.innerText || '').trim().length > 20;
      }, undefined, { timeout: 90000 });

      // The composer is still on screen after the answer arrives.
      await expect(composer).toBeInViewport({ timeout: 10000 });
      expect(errors).toEqual([]);
    });
  });
}
