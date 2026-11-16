import { describe, it, expect, beforeAll } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getPool } from '../src/db/pool.js';

// These columns are filtered on every ordinary request (the user's ratings,
// the admin inbox, every OTP issue, every failed sign-in). Migration 007 adds
// the supporting indexes; without them each statement is a sequential scan
// that grows with the table.
//
// pg-mem cannot answer pg_indexes, so the index shape is read from the SQL that
// the runner applied, and the runner is asked to confirm it applied this file.

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

const indexes = () => {
  const sql = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(migrationsDir, f), 'utf8'))
    .join('\n');

  const found = [];
  for (const match of sql.matchAll(/CREATE INDEX(?:\s+IF NOT EXISTS)?\s+\w+\s+ON\s+(\w+)\s*\(([^)]+)\)/gi)) {
    found.push({
      table: match[1].toLowerCase(),
      columns: match[2].split(',').map((c) => c.trim().split(/\s+/)[0].toLowerCase()),
    });
  }
  return found;
};

beforeAll(async () => {
  await getPool();
});

describe('hot-path indexes', () => {
  it.each([
    ['ratings', 'user_id'],
    ['reports', 'status'],
    ['otps', 'expires_at'],
    ['auth_attempts', 'updated_at'],
  ])('%s is indexed on %s', (table, column) => {
    const index = indexes().find((i) => i.table === table && i.columns[0] === column);
    expect(index).toBeDefined();
  });

  it('leads the ratings index with the sort column so GET /ratings needs no sort', () => {
    const index = indexes().find((i) => i.table === 'ratings' && i.columns[0] === 'user_id');
    expect(index.columns).toContain('at');
  });

  it('leads the reports index with status and carries the sort column', () => {
    const index = indexes().find((i) => i.table === 'reports' && i.columns[0] === 'status');
    expect(index.columns).toContain('at');
  });

  it('was actually applied by the migration runner', async () => {
    const pool = await getPool();
    const { rows } = await pool.query(
      "SELECT version FROM schema_migrations WHERE version LIKE '%007%'"
    );
    expect(rows).toHaveLength(1);
  });

  it('indexes the expression the city lookup actually uses', () => {
    // getCatalogueByCity filters with lower(city); a plain (city) index cannot
    // serve that, so the catalogue was scanned on every recommendation.
    const sql = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(join(migrationsDir, f), 'utf8'))
      .join('\n');

    expect(sql).toMatch(/CREATE INDEX[^;]*ON\s+restaurants\s*\(\s*lower\(city\)\s*\)/i);
  });
});
