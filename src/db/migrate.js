// Migration runner: node src/db/migrate.js  (npm run db:migrate)
// Applies migrations/*.sql in filename order, tracked in schema_migrations.
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getPool, closePool } from './pool.js';
import { logger } from '../lib/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '../../migrations');

export const runMigrations = async (pool) => {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const applied = new Set();
  try {
    const { rows } = await pool.query('SELECT version FROM schema_migrations');
    for (const r of rows) applied.add(r.version);
  } catch (err) {
    if (!/does not exist|no such table/i.test(err.message)) throw err;
    // schema_migrations itself comes from 001 — run everything.
  }
  const ran = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      await pool.query('COMMIT');
      ran.push(file);
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  }
  return ran;
};

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('db/migrate.js');

if (isMain) {
  try {
    const pool = getPool();
    const ran = await runMigrations(pool);
    logger.info({ ran }, 'migrations complete');
    console.log(JSON.stringify({ ran }));
  } catch (err) {
    logger.error({ err: err.message, code: err.code }, 'migration failed');
    console.error(`migration failed: ${err.code || err.message}`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
