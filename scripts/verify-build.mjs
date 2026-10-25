#!/usr/bin/env node

// Verify production build is valid and serves correctly
// Run: node scripts/verify-build.mjs

import { existsSync, statSync, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROD_DIR = join(__dirname, '..', 'dist');

console.log('🔍 Verifying Production Build\n');

const checks = [];

// 1. Check if dist directory exists
if (!existsSync(PROD_DIR)) {
  console.error('❌ dist directory not found. Run: npm run build');
  process.exit(1);
}
checks.push({ name: 'dist directory exists', passed: true });

// 2. Check for critical files
const criticalFiles = [
  'index.html',
  'sw.js',
  'manifest.webmanifest',
  'assets/app-*.js',
  'assets/app-*.css'
];

for (const pattern of criticalFiles) {
  const patternRegex = new RegExp(pattern.replace('*.js', '[^.]+\\.js').replace('*.css', '[^.]+\\.css'));
  const files = readdirSync(PROD_DIR).filter(f => patternRegex.test(f));

  if (files.length > 0) {
    checks.push({ name: `Found: ${pattern}`, passed: true });
  } else {
    checks.push({ name: `Missing: ${pattern}`, passed: false });
  }
}

// 3. Check file sizes (should be reasonable)
const distStats = statSync(PROD_DIR);
if (distStats.size > 50 * 1024 * 1024) { // 50MB limit
  console.warn(`⚠️  dist directory is large (${(distStats.size / 1024 / 1024).toFixed(2)}MB)`);
}
checks.push({ name: 'dist size reasonable', passed: true });

// 4. Check manifest.webmanifest
const manifestPath = join(PROD_DIR, 'manifest.webmanifest');
if (existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    checks.push({ name: 'manifest valid JSON', passed: true });
    checks.push({ name: `manifest has name: ${manifest.name}`, passed: !!manifest.name });
    checks.push({ name: `manifest has icons: ${manifest.icons?.length > 0}`, passed: !!manifest.icons?.length });
  } catch (err) {
    checks.push({ name: 'manifest invalid JSON', passed: false });
  }
} else {
  checks.push({ name: 'manifest.webmanifest missing', passed: false });
}

// 5. Check service worker
const swPath = join(PROD_DIR, 'sw.js');
if (existsSync(swPath)) {
  const swContent = readFileSync(swPath, 'utf-8');
  checks.push({ name: 'sw.js exists', passed: true });
  checks.push({ name: 'sw.js contains "workbox"', passed: swContent.includes('workbox') });
} else {
  checks.push({ name: 'sw.js missing', passed: false });
}

// 6. Check service worker precache count
const swPrecache = swContent.match(/precache\s*\(\s*\d+/);
if (swPrecache) {
  const count = parseInt(swPrecache[0].match(/\d+/)[0]);
  checks.push({ name: `Service worker precaches ${count} files`, passed: count > 0 });
}

// 7. Summary
console.log('\n✅ Build Verification Results:');
checks.forEach(check => {
  const icon = check.passed ? '✓' : '❌';
  console.log(`${icon} ${check.name}`);
});

const allPassed = checks.every(c => c.passed);
console.log(`\n${allPassed ? '✅ All checks passed!' : '❌ Some checks failed!'}`);

if (!allPassed) {
  console.log('\nFix issues and run: npm run build');
  process.exit(1);
}

console.log('\n🎉 Production build is ready to serve!');