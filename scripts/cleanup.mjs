// Cleanup script for test data and development artifacts
// Run: node scripts/cleanup.mjs

import { readFileSync, existsSync, unlinkSync, rmSync, readdirSync } from 'fs';
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
    if (existsSync(filePath)) {
      console.log(`Removing ${file}...`);
      unlinkSync(filePath);
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
  if (existsSync(cachePath)) {
    console.log(`Clearing ${dir}...`);
    rmSync(cachePath, { recursive: true, force: true });
  }
}

// 4. Remove temporary test files. The patterns are matched against the entries
// in the repository root; `*` is the only wildcard supported.
const patternToRegExp = (pattern) =>
  new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);

const tempPatterns = [
  'test-body.json',
  'test-inject-*.json',
  'test-signin.json',
  'test-signup.json',
  'test-recommend.json',
  'test-saved-place.json',
  'test-sp-1.json',
  'test-sp-2.json',
  'test-output.txt',
  'fix-store.js',
  'fix-store.mjs'
];

const rootEntries = readdirSync(process.cwd());
for (const pattern of tempPatterns) {
  const matcher = patternToRegExp(pattern);
  for (const entry of rootEntries.filter(name => matcher.test(name))) {
    const filePath = join(process.cwd(), entry);
    console.log(`Removing ${entry}...`);
    unlinkSync(filePath);
  }
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
