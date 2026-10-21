import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = 'docs/media';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' }).catch(async () => {
  return chromium.launch();
});

async function shot(url, file, viewport, waitFor) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    if (waitFor) await page.waitForSelector(waitFor, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1200); // let fonts/animation settle
    await page.screenshot({ path: `${OUT}/${file}`, fullPage: false });
    console.log('captured', file);
  } catch (e) {
    console.log('FAILED', file, e.message.split('\n')[0]);
  } finally {
    await ctx.close();
  }
}

const BASE = process.env.BASE_URL || 'https://naijataste-ai.vercel.app';
await shot(BASE + '/', 'shot-landing-desktop.png', { width: 1280, height: 800 }, 'h1');
await shot(BASE + '/', 'shot-landing-mobile.png', { width: 390, height: 844 }, 'h1');
await shot(BASE + '/app/login', 'shot-login-desktop.png', { width: 1280, height: 800 }, 'form');
await shot(BASE + '/app/login', 'shot-login-mobile.png', { width: 390, height: 844 }, 'form');

await browser.close();
console.log('done');
