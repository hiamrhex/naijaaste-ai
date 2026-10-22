// Read-only inspection of the live database schema (no writes).
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const cols = await pool.query(
  "SELECT column_name FROM information_schema.columns WHERE table_name = 'sessions' ORDER BY column_name"
);
console.log('sessions columns:', cols.rows.map((c) => c.column_name).join(', '));

const mig = await pool.query('SELECT version FROM schema_migrations ORDER BY version');
console.log('applied migrations:', mig.rows.map((r) => r.version).join(' | '));

await pool.end();
