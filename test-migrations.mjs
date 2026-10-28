import { newDb } from 'pg-mem';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const db = newDb();
db.public.registerFunction({
  name: 'gen_random_uuid',
  returns: 'uuid',
  implementation: () => crypto.randomUUID(),
  impure: true,
});

const { Pool } = db.adapters.createPg();
const pool = new Pool();

const MIGRATIONS_DIR = join(__dirname, 'migrations');
const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();

async function run() {
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
    console.log('Running:', file);
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      try {
        await pool.query(stmt);
        console.log('  OK:', stmt.substring(0, 60));
      } catch (err) {
        console.error('  FAILED:', stmt.substring(0, 60), err.message);
        throw err;
      }
    }
    try {
      await pool.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      console.log('  Version recorded');
    } catch (err) {
      console.error('  Version insert failed:', err.message);
      throw err;
    }
  }
  console.log('All migrations applied');
  
  const { rows } = await pool.query("SELECT * FROM schema_migrations");
  console.log('Migrations recorded:', rows);
}

run().catch(e => console.error(e));