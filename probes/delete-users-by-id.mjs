// Deletes accounts BY EXACT FULL ID - never by a pattern.
//
//   node probes/delete-users-by-id.mjs <user-id> [<user-id> ...]
//
// One transaction: the child rows first (they would otherwise be orphaned,
// because sessions.user_id and reports.user_id are ON DELETE SET NULL), then
// the users. Prints the counts before and after, and a fingerprint of every
// other user's data - if anything else moved, the transaction is rolled back.
//
// This is the same guarded delete used for the audit accounts (L21-09).
import 'dotenv/config';
import pg from 'pg';

const ARGS = process.argv.slice(2);
if (!ARGS.length) {
  console.error('usage: node probes/delete-users-by-id.mjs <user-id|email:exact@address> [...]');
  process.exit(2);
}

// The resolved ids, shared with the helpers below.
let IDS = [];

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  keepAlive: true,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 15_000,
  statement_timeout: 30_000,      // a stuck query must fail, not hang
  query_timeout: 30_000,
});
pool.on('error', () => { /* an idle pooled connection was closed - the next query reconnects */ });

// Arguments are either a full user id, or `email:<exact address>` which is
// resolved with an EQUALITY match (never a pattern) so a mistyped id cannot
// silently skip a row.
const resolveTargets = async (c, args) => {
  const ids = [];
  for (const arg of args) {
    if (/^[0-9a-f-]{36}$/i.test(arg)) { ids.push(arg); continue; }
    if (arg.startsWith('email:')) {
      const email = arg.slice(6);
      const { rows } = await c.query('SELECT id FROM users WHERE email = $1', [email]);
      if (rows.length !== 1) {
        console.error(`  ! "${email}" matched ${rows.length} user(s) - skipped`);
        continue;
      }
      ids.push(rows[0].id);
      continue;
    }
    console.error(`  ! ignoring unrecognised argument "${arg}"`);
  }
  return ids;
};

// Digests are computed IN the database: a md5 over the rows, so a check never
// ships megabytes over the wire (and never leaves the connection idle long
// enough for Neon to drop it).
const fingerprint = async (c) => {
  const out = {};
  for (const t of ['users', 'sessions', 'favorites', 'saved_places', 'ratings', 'reports', 'refresh_tokens', 'otps', 'auth_attempts', 'restaurants']) {
    const { rows } = await c.query(`SELECT count(*)::int AS c FROM ${t}`);
    out[t] = rows[0].c;
  }
  const { rows: others } = await c.query(
    `SELECT count(*)::int AS c,
            md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) AS d
       FROM (SELECT id, email, role, created_at, last_login FROM users
              WHERE NOT (id = ANY($1)) ORDER BY id) t`,
    [IDS]
  );
  out.other_users = others[0].c;
  out.other_digest = others[0].d;
  for (const [t, where] of [
    ['sessions', 'user_id IS NULL OR NOT (user_id = ANY($1))'],
    ['favorites', 'user_id IS NULL OR NOT (user_id = ANY($1))'],
    ['saved_places', 'user_id IS NULL OR NOT (user_id = ANY($1))'],
    ['ratings', 'user_id IS NULL OR NOT (user_id = ANY($1))'],
    ['reports', 'user_id IS NULL OR NOT (user_id = ANY($1))'],
    ['refresh_tokens', 'user_id IS NULL OR NOT (user_id = ANY($1))'],
  ]) {
    const { rows } = await c.query(
      `SELECT count(*)::int AS c,
              md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) AS d
         FROM (SELECT * FROM ${t} WHERE ${where} ORDER BY 1) t`,
      [IDS]
    );
    out[`${t}_digest`] = rows[0].d;
    out[`${t}_count`] = rows[0].c;
  }
  return out;
};

const targetCounts = async (c) => {
  const t = {};
  const q = async (sql, p) => (await c.query(sql, p)).rowCount;
  t.users = await q('SELECT id FROM users WHERE id = ANY($1)', [IDS]);
  t.sessions = await q('SELECT id FROM sessions WHERE user_id = ANY($1)', [IDS]);
  t.saved_places = await q('SELECT id FROM saved_places WHERE user_id = ANY($1)', [IDS]);
  t.favorites = await q('SELECT user_id FROM favorites WHERE user_id = ANY($1)', [IDS]);
  t.ratings = await q('SELECT id FROM ratings WHERE user_id = ANY($1)', [IDS]);
  t.reports = await q('SELECT ticket FROM reports WHERE user_id = ANY($1)', [IDS]);
  t.refresh_tokens = await q('SELECT jti FROM refresh_tokens WHERE user_id = ANY($1)', [IDS]);
  return t;
};

try {
  const client = await pool.connect();
  IDS = await resolveTargets(client, ARGS);
  console.log('=== targets ===');
  const { rows: targets } = await client.query(
    'SELECT id, email, created_at FROM users WHERE id = ANY($1) ORDER BY email',
    [IDS]
  );
  for (const u of targets) console.log(`  ${u.email.padEnd(46)} ${u.id}`);
  console.log(`  (${IDS.length - targets.length} id(s) matched no user)`);

  const before = await targetCounts(client);
  console.log('\n=== before ===');
  for (const [k, v] of Object.entries(before)) console.log(`  ${k.padEnd(16)} ${v}`);
  const fpBefore = await fingerprint(client);
  console.log(`  other users      ${fpBefore.other_users}`);

  await client.query('BEGIN');
  const dels = {
    refresh_tokens: (await client.query('DELETE FROM refresh_tokens WHERE user_id = ANY($1)', [IDS])).rowCount,
    favorites: (await client.query('DELETE FROM favorites WHERE user_id = ANY($1)', [IDS])).rowCount,
    saved_places: (await client.query('DELETE FROM saved_places WHERE user_id = ANY($1)', [IDS])).rowCount,
    sessions: (await client.query('DELETE FROM sessions WHERE user_id = ANY($1)', [IDS])).rowCount,
    reports: (await client.query('DELETE FROM reports WHERE user_id = ANY($1)', [IDS])).rowCount,
    ratings: (await client.query('DELETE FROM ratings WHERE user_id = ANY($1)', [IDS])).rowCount,
    users: (await client.query('DELETE FROM users WHERE id = ANY($1)', [IDS])).rowCount,
  };
  console.log('\n=== deleted ===');
  for (const [k, v] of Object.entries(dels)) console.log(`  ${k.padEnd(16)} ${v}`);

  const after = await targetCounts(client);
  const fpAfter = await fingerprint(client);
  console.log('\n=== after (before COMMIT) ===');
  for (const [k, v] of Object.entries(after)) console.log(`  ${k.padEnd(16)} ${v}`);
  const sameUsers = fpBefore.other_digest === fpAfter.other_digest;
  const sameRows = ['sessions', 'favorites', 'saved_places', 'ratings', 'reports', 'refresh_tokens']
    .every((t) => fpBefore[`${t}_digest`] === fpAfter[`${t}_digest`]);
  console.log(`\n  other users unchanged : ${sameUsers ? 'YES' : 'NO'}`);
  console.log(`  other rows unchanged  : ${sameRows ? 'YES' : 'NO'}`);

  if (!sameUsers || !sameRows || Object.values(after).some((v) => v !== 0)) {
    await client.query('ROLLBACK');
    console.log('\nROLLBACK - something else moved or a target survived.');
    process.exitCode = 1;
  } else {
    await client.query('COMMIT');
    console.log('\nCOMMIT - the listed accounts and their rows are gone.');
  }
  client.release();
} catch (err) {
  console.error('\nROLLBACK due to an error:', err.message);
  console.error('(the transaction was not committed - nothing was deleted)');
  process.exitCode = 1;
} finally {
  // pool.end() can wait on a stuck connection: never let it hang the script.
  await Promise.race([pool.end().catch(() => {}), new Promise((r) => setTimeout(r, 10_000))]);
}
