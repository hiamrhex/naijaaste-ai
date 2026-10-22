// The user path, in a real browser, against the LIVE deployment.
//
//   node probes/live-browser-check.mjs
//
// Signs up on the deployed site, sends a chat message, and checks that the
// answer is rendered - the flow that used to fail with an unparseable
// response. Uses playwright's chromium (or Edge via PW_CHANNEL).
import { chromium } from 'playwright';

const BASE = 'https://naijataste-ai.vercel.app';
const stamp = Date.now();
const email = `browser-${stamp}@example.com`;

const browser = await chromium.launch(
  process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}
);
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

const step = (label, ok, extra = '') =>
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(46)} ${extra}`);

try {
  // 1. The app shell loads and the CSP does not block the bundle.
  await page.goto(`${BASE}/app/signup`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /create account/i }).first().waitFor({ timeout: 20000 });
  step('app shell loads under the strict CSP', true);

  // 2. Sign up (a POST with a body - the request that used to 500).
  await page.getByPlaceholder(/ada obi/i).fill('Browser Probe');
  await page.getByPlaceholder(/you@example\.com/i).fill(email);
  await page.getByPlaceholder(/at least 8 characters/i).fill('Str0ng!Passw0rd!');
  await page.locator('form button[type="submit"]').click();
  await page.getByRole('navigation', { name: /main sections/i }).waitFor({ timeout: 20000 });
  step('signup succeeds on the live site', true);

  // 3. Send a chat message (the flow from the bug report).
  await page.getByPlaceholder(/describe yourself/i).fill('I am a student in Lagos, tight budget, love pepper soup');
  await page.getByRole('button', { name: /send message/i }).click();

  // The message bubbles are the .bubble-in elements (the log also holds the
  // scroll anchor and the loading indicator, which are not messages).
  // Wait until the last bubble carries text - the reply bubble is created a
  // moment before its content renders.
  const log = page.locator('[role="log"]');
  await page.waitForFunction(() => {
    const bubbles = [...document.querySelectorAll('[role="log"] .bubble-in')];
    if (bubbles.length < 3) return false;
    const last = bubbles[bubbles.length - 1];
    const text = (last.innerText || '').trim();
    // The assistant's reply: not the user's own message, and real text.
    return text.length > 20 && !/student in Lagos, tight budget/i.test(text);
  }, undefined, { timeout: 90000 });
  const bubbles = await log.locator('.bubble-in').allInnerTexts();
  const answer = String(bubbles[bubbles.length - 1] || '').replace(/\s+/g, ' ').trim();
  const answered = answer.length > 20 && !/student in Lagos, tight budget/i.test(answer);
  step('the assistant answers with its own reply', answered, answer.slice(0, 160));

  // 4. No raw parser error anywhere in the UI.
  const body = await page.locator('body').innerText();
  step('no JSON parser error in the UI', !/Unexpected token|is not valid JSON/i.test(body));
  step('no unhandled page errors', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 120));
  step('no console errors', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 120));

  // 5. Clean up the probe account.
  await page.getByRole('link', { name: /^settings$/i }).click();
  const signout = page.getByTestId('settings-signout');
  if (await signout.count()) {
    await signout.click();
    await page.waitForTimeout(1500);
  }
  step('signed out after the check', true);
} catch (err) {
  step('browser flow', false, String(err.message).split('\n')[0].slice(0, 160));
} finally {
  await browser.close();
}
