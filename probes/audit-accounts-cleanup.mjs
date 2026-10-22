// Deletes the three audit accounts (exact full ids only) in ONE transaction.
//
//   node probes/audit-accounts-cleanup.mjs
//
// Nothing is deleted by pattern: every statement names the full id of the
// row it removes. The script prints the row counts BEFORE the delete, the
// counts AFTER (which must be zero), and a fingerprint of every OTHER
// user's data before and after - they must be identical, which is the
// proof that no other user's data moved.
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ── The exact targets (full ids, from probes/audit-accounts-inventory.mjs) ──
const USER_IDS = [
  'ff7ecb97-ac87-4fea-8511-65ccd4dfbf74', // audita_1792451307974@example.com
  'a3d0048c-8906-4cdb-9ee5-d2a968a135f7', // auditb_1792451380577@example.com
  'bb6ba177-1b02-4923-ae8e-11251f2baa02', // mass_1792451393518@example.com
];
const SESSION_IDS = ['51f47f11-5d33-402d-ae82-d5d6a770fe6a'];
const SAVED_PLACE_IDS = [
  '0eaa765a-c103-42f7-842c-3ab8ca31d807',
  '43d25702-935a-4a51-bf9d-9968092cf036',
  '55e7345c-0a7a-45d1-81cf-247dbd4f2ab3',
  '56d7ea3c-1f51-4726-a58c-5812155149c6',
  '5f13b575-9f59-4e05-96fc-e08e980229f1',
  '6045b3d8-982f-4170-973f-2e0aea3a9848',
  'f7bc22ae-474f-434b-bcf4-6c3a9b004758',
];
const FAVORITE_PAIRS = [['ff7ecb97-ac87-4fea-8511-65ccd4dfbf74', 'r009']];
const REPORT_TICKETS = ['NT-171JUR', 'NT-LJ1Y56', 'NT-OWPWOP'];
const AUDIT_EMAIL_PATTERNS = ['audita_%', 'auditb_%', 'mass_%'];

const fingerprint = async (client) => {
  const out = {};
  for (const table of ['users', 'sessions', 'favorites', 'saved_places', 'ratings', 'reports', 'refresh_tokens', 'otps', 'auth_attempts', 'restaurants']) {
    const { rows } = await client.query(`SELECT count(*)::int AS c FROM ${table}`);
    out[table] = rows[0].c;
  }
  const { rows: others } = await client.query(
    `SELECT id, email, created_at, last_login, role FROM users
      WHERE NOT (email LIKE ANY($1)) ORDER BY id`,
    [AUDIT_EMAIL_PATTERNS]
  );
  out.other_users = others.length;
  out.other_user_digest = others
    .map((u) => `${u.id}:${u.email}:${u.role}:${u.created_at?.toISOString?.() ?? u.created_at}:${u.last_login ?? '-'}`)
    .join('|');
  // A digest of the OTHER users' user-scoped rows.
  const parts = [];
  for (const [table, order] of [
    ['sessions', 'id'], ['favorites', 'user_id, restaurant_id'], ['saved_places', 'id'],
    ['ratings', 'id'], ['reports', 'ticket'], ['refresh_tokens', 'jti'],
  ]) {
    const { rows } = await client.query(
      `SELECT * FROM ${table}
        WHERE user_id IS NULL OR NOT (user_id = ANY($1))
        ORDER BY ${order}`,
      [USER_IDS]
    );
    parts.push(`${table}:${rows.length}:${rows.map((r) => JSON.stringify(r)).join('')}`);
  }
  out.other_rows_digest = parts.join('|');
  return out;
};

const targets = async (client) => {
  const t = {};
  const q = async (sql, params) => (await client.query(sql, params)).rowCount;
  t.users = await q('SELECT id FROM users WHERE id = ANY($1)', [USER_IDS]);
  t.sessions = await q('SELECT id FROM sessions WHERE id = ANY($1)', [SESSION_IDS]);
  t.saved_places = await q('SELECT id FROM saved_places WHERE id = ANY($1)', [SAVED_PLACE_IDS]);
  t.favorites = 0;
  for (const [userId, restaurantId] of FAVORITE_PAIRS) {
    t.favorites += await q('SELECT user_id FROM favorites WHERE user_id = $1 AND restaurant_id = $2', [userId, restaurantId]);
  }
  t.reports = await q('SELECT ticket FROM reports WHERE ticket = ANY($1)', [REPORT_TICKETS]);
  t.refresh_tokens = await q('SELECT jti FROM refresh_tokens WHERE user_id = ANY($1)', [USER_IDS]);
  t.ratings = await q('SELECT id FROM ratings WHERE user_id = ANY($1)', [USER_IDS]);
  t.otps = await q('SELECT email FROM otps WHERE email LIKE ANY($1)', [AUDIT_EMAIL_PATTERNS]);
  t.auth_attempts = await q('SELECT email FROM auth_attempts WHERE email LIKE ANY($1)', [AUDIT_EMAIL_PATTERNS]);
  return t;
};

const client = await pool.connect();
try {
  console.log('=== BEFORE (inside the transaction) ===');
  const before = await targets(client);
  for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(16)} ${v}`);
  const fpBefore = await fingerprint(client);
  console.log(`  other users      ${fpBefore.other_users} (digest ${fpBefore.other_user_digest.length} chars)`);

  console.log('\n=== DELETE (exact ids only) ===');
  await client.query('BEGIN');
  const d1 = await client.query('DELETE FROM refresh_tokens WHERE jti IN (SELECT jti FROM refresh_tokens WHERE user_id = ANY($1))', [USER_IDS]);
  console.log(`  refresh_tokens   ${d1.rowCount}`);
  for (const [userId, restaurantId] of FAVORITE_PAIRS) {
    const d = await client.query('DELETE FROM favorites WHERE user_id = $1 AND restaurant_id = $2', [userId, restaurantId]);
    console.log(`  favorites       ${d.rowCount}`);
  }
  const d2 = await client.query('DELETE FROM saved_places WHERE id = ANY($1)', [SAVED_PLACE_IDS]);
  console.log(`  saved_places    ${d2.rowCount}`);
  const d3 = await client.query('DELETE FROM sessions WHERE id = ANY($1)', [SESSION_IDS]);
  console.log(`  sessions        ${d3.rowCount}`);
  const d4 = await client.query('DELETE FROM reports WHERE ticket = ANY($1)', [REPORT_TICKETS]);
  console.log(`  reports         ${d4.rowCount}`);
  const d5 = await client.query('DELETE FROM users WHERE id = ANY($1)', [USER_IDS]);
  console.log(`  users           ${d5.rowCount}`);

  console.log('\n=== AFTER (before COMMIT) ===');
  const after = await targets(client);
  for (const [k, v] of Object.entries(after)) console.log(`  ${k.padEnd(16)} ${v}`);
  const zero = Object.entries(after).filter(([k, v]) => k !== 'auth_attempts' && v !== 0);
  if (zero.length) throw new Error(`rows still present before COMMIT: ${JSON.stringify(zero)}`);

  const fpAfter = await fingerprint(client);
  console.log(`  other users      ${fpAfter.other_users} (digest ${fpAfter.other_user_digest.length} chars)`);

  const sameUsers = fpBefore.other_user_digest === fpAfter.other_user_digest;
  const sameRows = fpBefore.other_rows_digest === fpAfter.other_rows_digest;
  const sameCounts = JSON.stringify(
    Object.fromEntries(Object.entries(fpBefore).filter(([k]) => !k.includes('digest') && k !== 'other_users'))
  ) === JSON.stringify(
    Object.fromEntries(Object.entries(fpAfter).filter(([k]) => !k.includes('digest') && k !== 'other_users'))
  );
  console.log(`\n  other users unchanged : ${sameUsers ? 'YES' : 'NO'}`);
  console.log(`  other rows unchanged  : ${sameRows ? 'YES' : 'NO'}`);
  console.log(`  table counts unchanged: ${sameCounts ? 'YES' : 'NO'} (except the deleted rows)`);

  if (!sameUsers || !sameRows) {
    await client.query('ROLLBACK');
    console.log('\nROLLBACK - something else changed, nothing was deleted.');
    process.exitCode = 1;
  } else {
    await client.query('COMMIT');
    console.log('\nCOMMIT - the three audit accounts and their rows are gone.');
  }
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('\nROLLBACK due to an error:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
