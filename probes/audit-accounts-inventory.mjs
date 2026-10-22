// READ-ONLY inventory of the three audit accounts.
//
// Shows the exact full ids and every row that belongs to them, plus a
// fingerprint of the rest of the database so the cleanup can be proven to
// touch nothing else. This script NEVER writes.
//
//   node probes/audit-accounts-inventory.mjs
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const AUDIT = ['audita_%', 'auditb_%', 'mass_%'];

const { rows: users } = await pool.query(
  `SELECT id, email, name, role, created_at, last_login
     FROM users
    WHERE email LIKE ANY($1)
    ORDER BY email`,
  [AUDIT]
);

console.log('=== audit accounts found ===');
if (!users.length) {
  console.log('(none)');
}
for (const u of users) {
  console.log(`  ${u.email}\n    id=${u.id}  role=${u.role}  created=${u.created_at.toISOString?.() ?? u.created_at}  last_login=${u.last_login ?? '-'}`);
}

const ids = users.map((u) => u.id);
if (ids.length) {
  const tables = [
    ['sessions', 'id'],
    ['favorites', 'user_id || \':\' || restaurant_id'],
    ['saved_places', 'id'],
    ['ratings', 'id'],
    ['reports', 'ticket'],
    ['refresh_tokens', 'jti'],
  ];
  console.log('\n=== rows owned by the audit accounts ===');
  for (const [table, label] of tables) {
    const { rows } = await pool.query(
      `SELECT ${label} AS label, user_id FROM ${table} WHERE user_id = ANY($1) ORDER BY 1`,
      [ids]
    );
    console.log(`  ${table.padEnd(16)} ${rows.length} row(s)`);
    for (const r of rows) console.log(`      ${r.label}`);
  }
  // otps and auth_attempts are keyed by email, not by user id.
  const emails = users.map((u) => u.email);
  for (const table of ['otps', 'auth_attempts']) {
    const { rows } = await pool.query(
      `SELECT * FROM ${table} WHERE email = ANY($1)`,
      [emails]
    );
    console.log(`  ${table.padEnd(16)} ${rows.length} row(s)`);
    for (const r of rows) console.log(`      ${JSON.stringify(r).slice(0, 160)}`);
  }
}

// Fingerprint of everything that is NOT an audit account: after the delete
// these numbers must be identical.
const fingerprint = async () => {
  const out = {};
  for (const table of ['users', 'sessions', 'favorites', 'saved_places', 'ratings', 'reports', 'refresh_tokens', 'otps', 'auth_attempts', 'restaurants']) {
    const { rows } = await pool.query(`SELECT count(*)::int AS c FROM ${table}`);
    out[table] = rows[0].c;
  }
  const { rows: others } = await pool.query(
    `SELECT id, email, created_at, last_login FROM users
      WHERE NOT (email LIKE ANY($1)) ORDER BY id`,
    [AUDIT]
  );
  out.other_users = others.length;
  out.other_user_digest = others
    .map((u) => `${u.id}:${u.email}:${u.created_at?.toISOString?.() ?? u.created_at}:${u.last_login ?? '-'}`)
    .join('|');
  return out;
};

const fp = await fingerprint();
console.log('\n=== fingerprint of everything else (must be unchanged after the delete) ===');
for (const [k, v] of Object.entries(fp)) {
  if (k === 'other_user_digest') {
    console.log(`  ${k.padEnd(20)} ${(v.length / 1024).toFixed(1)} KiB digest of ${fp.other_users} other users`);
  } else {
    console.log(`  ${k.padEnd(20)} ${v}`);
  }
}

await pool.end();
