// Generate a new migration file with proper timestamp and template
// Usage: node scripts/generate-migration.mjs <filename>
// Example: node scripts/generate-migration.mjs add_users_table

import { existsSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

// ISO is 2026-10-28T22:38:12.380Z; stripping -:. gives 20261028T223812380Z.
// Keep all 15 chars of YYYYMMDDTHHMMSS - slicing 14 cut the seconds in half.
const timestamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15);

const usage = `Usage: node scripts/generate-migration.mjs <filename>

Example: node scripts/generate-migration.mjs add_users_table

Creates a new migration file with:
- Proper timestamp prefix
- Standard template with rollback support
- Description header
- Instructions for the developer

Filename should be descriptive, lowercase, and use underscores for spaces.
`;

if (process.argv.length < 3) {
  console.error(usage);
  process.exit(1);
}

const migrationName = process.argv[2];
// Restrict to a safe slug: anything else could escape the migrations directory
// (e.g. "../src/app") or produce a file the runner cannot sort predictably.
if (!migrationName || !/^[a-z0-9_]+$/.test(migrationName)) {
  console.error('❌ Filename must be lowercase letters, digits, and underscores only');
  console.error(usage);
  process.exit(1);
}

const filename = `${timestamp}_${migrationName}.sql`;

const migrationTemplate = `-- ${filename}
-- Migration: ${migrationName}
-- Created: ${new Date().toISOString()}
--
-- Description: 
--   [Add a brief description of what this migration does]
--
-- Changes:
--   - [Change 1]
--   - [Change 2]
--
-- Rollback: 
--   [How to roll back this migration if needed]
--
-- Migration completed: ${new Date().toISOString()}
`;

console.log(`📝 Creating migration file: ${filename}\n`);

try {
  // Check if file already exists
  const filePath = join(MIGRATIONS_DIR, filename);
  if (existsSync(filePath)) {
    console.error(`❌ Migration file already exists: ${filename}`);
    process.exit(1);
  }

  // Write migration file
  writeFileSync(filePath, migrationTemplate, 'utf-8');
  console.log(`✅ Migration file created: ${filename}`);
  console.log(`\n📝 Next steps:`);
  console.log(`  1. Edit ${filename} to add your migration SQL`);
  console.log(`  2. Run migrations: npm run db:migrate`);
  console.log(`  3. Test the migration locally before deploying`);

  // List recent migrations
  const existingMigrations = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .slice(-5);

  if (existingMigrations.length > 0) {
    console.log(`\n📋 Recent migrations:`);
    existingMigrations.forEach(mig => console.log(`  - ${mig}`));
  }

} catch (err) {
  console.error(`❌ Error creating migration: ${err.message}`);
  process.exit(1);
}