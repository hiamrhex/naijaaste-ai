// READ-ONLY: find the throwaway accounts created by this session's probes.
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const PREFIXES = [
  'liveprobe-%', 'browser-%', 'dbg-%', 'sweep-%', 'timing-%', 'ownera-%', 'ownerb-%',
  'probe-live-%', 'probe-%', 'e2e%', 'otp%', 'reset%', 'nearby%', 'user%', 'other%', 'a%', 'b%', 'm%',
];

const { rows } = await pool.query(
  `SELECT id, email, created_at, last_login FROM users
    WHERE email LIKE ANY($1) ORDER BY created_at`,
  [PREFIXES]
);

console.log(`=== ${rows.length} candidate probe account(s) ===`);
for (const u of rows) {
  console.log(`  ${u.email.padEnd(44)} ${u.id}  created=${u.created_at?.toISOString?.() ?? u.created_at}`);
}
if (!rows.length) console.log('  (none)');

const others = await pool.query(
  `SELECT count(*)::int AS c FROM users WHERE NOT (email LIKE ANY($1))`,
  [PREFIXES]
);
console.log(`\n  other users: ${others.rows[0].c}`);

await pool.end();
