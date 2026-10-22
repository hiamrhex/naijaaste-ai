// Post-cleanup verification: the audit accounts are gone, and every other
// table changed by EXACTLY the number of rows that belonged to them.
//
//   node probes/audit-accounts-verify.mjs
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const USER_IDS = [
  'ff7ecb97-ac87-4fea-8511-65ccd4dfbf74',
  'a3d0048c-8906-4cdb-9ee5-d2a968a135f7',
  'bb6ba177-1b02-4923-ae8e-11251f2baa02',
];
const SESSION_IDS = ['51f47f11-5d33-402d-ae82-d5d6a770fe6a'];
const SAVED_PLACE_IDS = [
  '0eaa765a-c103-42f7-842c-3ab8ca31d807', '43d25702-935a-4a51-bf9d-9968092cf036',
  '55e7345c-0a7a-45d1-81cf-247dbd4f2ab3', '56d7ea3c-1f51-4726-a58c-5812155149c6',
  '5f13b575-9f59-4e05-96fc-e08e980229f1', '6045b3d8-982f-4170-973f-2e0aea3a9848',
  'f7bc22ae-474f-434b-bcf4-6c3a9b004758',
];
const REPORT_TICKETS = ['NT-171JUR', 'NT-LJ1Y56', 'NT-OWPWOP'];
const PATTERNS = ['audita_%', 'auditb_%', 'mass_%'];

// Expected deltas: how many rows the cleanup was allowed to remove.
const EXPECTED_DELTA = {
  users: 3,
  sessions: 1,
  saved_places: 7,
  favorites: 1,
  reports: 3,
  refresh_tokens: 7,
  ratings: 0,
  otps: 0,
  auth_attempts: 0,
  restaurants: 0,
};
const BEFORE_TOTALS = {
  users: 350, sessions: 91, favorites: 11, saved_places: 476,
  ratings: 24, reports: 27, refresh_tokens: 352, otps: 0,
  auth_attempts: 1, restaurants: 210,
};

console.log('=== the audit accounts are gone ===');
const { rows: users } = await pool.query(
  'SELECT id, email FROM users WHERE id = ANY($1) OR email LIKE ANY($2) ORDER BY email',
  [USER_IDS, PATTERNS]
);
console.log(`  users matching the three ids or email patterns: ${users.length}`);
for (const u of users) console.log(`    ${u.email} ${u.id}`);

const leftover = async (label, sql, params) => {
  const { rows } = await pool.query(sql, params);
  console.log(`  ${label.padEnd(24)} ${rows.length}`);
  for (const r of rows) console.log(`      ${JSON.stringify(r).slice(0, 140)}`);
  return rows.length;
};
console.log('\n=== their child rows are gone ===');
let leftoverTotal = 0;
leftoverTotal += await leftover('sessions', 'SELECT id FROM sessions WHERE id = ANY($1)', [SESSION_IDS]);
leftoverTotal += await leftover('saved_places', 'SELECT id FROM saved_places WHERE id = ANY($1)', [SAVED_PLACE_IDS]);
leftoverTotal += await leftover('reports', 'SELECT ticket FROM reports WHERE ticket = ANY($1)', [REPORT_TICKETS]);
leftoverTotal += await leftover('favorites', 'SELECT user_id, restaurant_id FROM favorites WHERE user_id = ANY($1)', [USER_IDS]);
leftoverTotal += await leftover('refresh_tokens', 'SELECT jti FROM refresh_tokens WHERE user_id = ANY($1)', [USER_IDS]);
leftoverTotal += await leftover('ratings', 'SELECT id FROM ratings WHERE user_id = ANY($1)', [USER_IDS]);
leftoverTotal += await leftover('otps', 'SELECT email FROM otps WHERE email LIKE ANY($1)', [PATTERNS]);
leftoverTotal += await leftover('auth_attempts', 'SELECT email FROM auth_attempts WHERE email LIKE ANY($1)', [PATTERNS]);

console.log('\n=== every table changed by exactly the deleted rows ===');
let drift = 0;
for (const [table, before] of Object.entries(BEFORE_TOTALS)) {
  const { rows } = await pool.query(`SELECT count(*)::int AS c FROM ${table}`);
  const after = rows[0].c;
  const expected = before - EXPECTED_DELTA[table];
  const ok = after === expected;
  if (!ok) drift++;
  console.log(`  ${table.padEnd(18)} ${before} -> ${after}   expected ${expected}   ${ok ? 'OK' : 'DRIFT'}`);
}
console.log(`\n  leftover audit rows: ${leftoverTotal}`);
console.log(`  tables with unexpected drift: ${drift}`);
console.log(`\nVERDICT: ${leftoverTotal === 0 && drift === 0 ? 'the three audit accounts are fully removed and no other data moved' : 'PROBLEM - inspect above'}`);

await pool.end();
