import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');
const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();

for (const file of files) {
  let sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
  console.log('\n===', file, '===');
  // Strip line comments, then split on semicolon.
  sql = sql.replace(/--.*$/gm, '');
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  statements.forEach((stmt, i) => {
    console.log(`\n--- Statement ${i + 1} ---`);
    console.log(stmt.substring(0, 200));
  });
}