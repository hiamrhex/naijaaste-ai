// Cleanup script for test data and development artifacts
// Run: node scripts/cleanup.mjs

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');

console.log('🧹 NaijaTaste-ai Development Cleanup\n');

// 1. Remove test data from JSON stores (if they exist)
if (process.env.NODE_ENV !== 'production') {
  const testFiles = [
    'sessions.json',
    'ratings.json',
    'reports.json',
    'test-data.json'
  ];

  for (const file of testFiles) {
    const filePath = join(DATA_DIR, file);
    if (require('fs').existsSync(filePath)) {
      console.log(`Removing ${file}...`);
      require('fs').unlinkSync(filePath);
    }
  }
}

// 2. Clear test accounts from pg-mem (if running)
if (!process.env.DATABASE_URL) {
  console.log('\n📝 Note: Test accounts in pg-mem will be cleared on next test run.');
  console.log('To clear them manually, run:');
  console.log('  npm test -- tests/auth.test.js --clear-db');
}

// 3. Cleanup cache directories
const cacheDirs = [
  'node_modules/.cache',
  '.vite',
  'dist/.vite',
  '.cache'
];

for (const dir of cacheDirs) {
  const cachePath = join(process.cwd(), dir);
  if (require('fs').existsSync(cachePath)) {
    console.log(`Clearing ${dir}...`);
    require('fs').rmSync(cachePath, { recursive: true, force: true });
  }
}

// 4. Remove temporary test files
const tempFiles = [
  'test-body.json',
  'test-inject-*.json',
  'test-signin.json',
  'test-signup.json',
  'test-recommend.json',
  'test-saved-place.json',
  'test-sp-1.json',
  'test-sp-2.json',
  'fix-store.js'
];

for (const pattern of tempFiles) {
  const glob = require('glob');
  glob(pattern, { cwd: process.cwd(), absolute: false }, (err, files) => {
    if (err) return;
    files.forEach(file => {
      const filePath = join(process.cwd(), file);
      if (require('fs').existsSync(filePath)) {
        console.log(`Removing ${file}...`);
        require('fs').unlinkSync(filePath);
      }
    });
  });
}

console.log('\n✅ Cleanup complete!');

// 5. Optional: Show usage statistics
if (process.env.NODE_ENV !== 'production') {
  const packageJson = JSON.parse(
    readFileSync(join(process.cwd(), 'package.json'), 'utf-8')
  );
  console.log('\n📊 Repository Info:');
  console.log(`  Package: ${packageJson.name}`);
  console.log(`  Version: ${packageJson.version}`);
  console.log(`  Description: ${packageJson.description}`);
}