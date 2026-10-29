#!/usr/bin/env node

// Verify production build is valid and serves correctly
// Run: node scripts/verify-build.mjs

import { existsSync, statSync, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROD_DIR = join(__dirname, '..', 'dist');
const ASSETS_DIR = join(PROD_DIR, 'assets');

console.log('🔍 Verifying Production Build\n');

const checks = [];

// 1. Check if dist directory exists
if (!existsSync(PROD_DIR)) {
  console.error('❌ dist directory not found. Run: npm run build');
  process.exit(1);
}
checks.push({ name: 'dist directory exists', passed: true });

// 2. Check for critical files. Hashed assets live in dist/assets, not dist,
// so each entry names its directory and a matcher for the file name.
const criticalFiles = [
  { dir: PROD_DIR, label: 'index.html', test: (f) => f === 'index.html' },
  { dir: PROD_DIR, label: 'sw.js', test: (f) => f === 'sw.js' },
  { dir: PROD_DIR, label: 'manifest.webmanifest', test: (f) => f === 'manifest.webmanifest' },
  { dir: ASSETS_DIR, label: 'assets/app-*.js', test: (f) => /^app-.+\.js$/.test(f) },
  { dir: ASSETS_DIR, label: 'assets/app-*.css', test: (f) => /^app-.+\.css$/.test(f) },
];

for (const { dir, label, test } of criticalFiles) {
  const files = existsSync(dir) ? readdirSync(dir).filter(test) : [];
  checks.push({ name: files.length ? `Found: ${label}` : `Missing: ${label}`, passed: files.length > 0 });
}

// 3. Check total build size (statSync on a directory does not report the
// recursive size on every platform, so walk the tree instead).
const dirSize = (dir) => {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(full) : statSync(full).size;
  }
  return total;
};
const sizeBytes = dirSize(PROD_DIR);
const sizeMb = sizeBytes / 1024 / 1024;
if (sizeMb > 50) {
  console.warn(`⚠️  dist directory is large (${sizeMb.toFixed(2)}MB)`);
}
checks.push({ name: `dist size reasonable (${sizeMb.toFixed(2)}MB)`, passed: sizeMb <= 50 });

// 4. Check manifest.webmanifest
const manifestPath = join(PROD_DIR, 'manifest.webmanifest');
if (existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    checks.push({ name: 'manifest valid JSON', passed: true });
    checks.push({ name: `manifest has name: ${manifest.name}`, passed: !!manifest.name });
    checks.push({ name: `manifest has icons: ${manifest.icons?.length > 0}`, passed: !!manifest.icons?.length });
  } catch {
    checks.push({ name: 'manifest invalid JSON', passed: false });
  }
} else {
  checks.push({ name: 'manifest.webmanifest missing', passed: false });
}

// 5. Check service worker. vite-plugin-pwa bundles workbox, so the literal
// string may not appear; a precache manifest or workbox runtime both count.
const swPath = join(PROD_DIR, 'sw.js');
let swContent = '';
if (existsSync(swPath)) {
  swContent = readFileSync(swPath, 'utf-8');
  checks.push({ name: 'sw.js exists', passed: true });
  checks.push({
    name: 'sw.js contains workbox or a precache manifest',
    passed: swContent.includes('workbox') || /precacheAndRoute|self\.__WB_MANIFEST/.test(swContent),
  });
} else {
  checks.push({ name: 'sw.js missing', passed: false });
}

// 6. Check service worker precache count
const swPrecache = swContent.match(/precache\s*\(\s*\d+/);
if (swPrecache) {
  const count = parseInt(swPrecache[0].match(/\d+/)[0], 10);
  checks.push({ name: `Service worker precaches ${count} files`, passed: count > 0 });
}

// 7. Summary
console.log('\n✅ Build Verification Results:');
checks.forEach((check) => {
  console.log(`${check.passed ? '✓' : '❌'} ${check.name}`);
});

const allPassed = checks.every((c) => c.passed);
console.log(`\n${allPassed ? '✅ All checks passed!' : '❌ Some checks failed!'}`);

if (!allPassed) {
  console.log('\nFix issues and run: npm run build');
  process.exit(1);
}

console.log('\n🎉 Production build is ready to serve!');
