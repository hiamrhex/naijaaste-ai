import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'msedge' });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  geolocation: { latitude: 6.5095, longitude: 3.3711 },
  permissions: ['geolocation'],
  baseURL: 'http://localhost:5173',
});
const page = await context.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(`[console] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => logs.push(`[FAILED] ${r.method()} ${r.url()} ${r.failure()?.errorText}`));
page.on('response', async (r) => {
  if (r.url().includes(':3000')) logs.push(`[resp] ${r.status()} ${r.request().method()} ${r.url()}`);
});

const stamp = Date.now();
await page.goto('/app/signup');
await page.getByPlaceholder(/ada obi/i).fill('Diag User');
await page.getByPlaceholder(/you@example\.com/i).fill(`diag${stamp}@example.com`);
await page.getByPlaceholder(/at least 8 characters/i).fill('Str0ng!Passw0rd');
await page.locator('form button[type="submit"]').click();
await page.getByRole('navigation', { name: /main sections/i }).waitFor({ timeout: 20000 });
logs.push('signed up OK');

await page.goto('/app/map');
await page.getByRole('button', { name: /near me/i }).click();
await page.waitForTimeout(6000);
logs.push('URL=' + page.url());
logs.push('BODY=' + JSON.stringify((await page.evaluate(() => document.body.innerText)).slice(0, 500)));
console.log(logs.join('\n'));
await page.screenshot({ path: 'test-results/diag-map.png', fullPage: true });
await browser.close();
