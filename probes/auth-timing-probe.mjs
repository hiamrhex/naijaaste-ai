// Timing-oracle measurement.
//
// The independent review (D-4 / IQ-21) found that the response time of
// the auth endpoints revealed whether an account existed. This probe measures
// both cases 50 times each and reports whether the two distributions are
// separable.
//
//   node probes/auth-timing-probe.mjs [tries] [port]
//
// It starts a real server (so the whole HTTP path is measured), creates one
// throwaway account, and afterwards deletes every row it created.
//
// The per-(email, ip) lockout would fire after 10 failed sign-ins, so the
// probe clears the lockout counter for its own probe addresses between
// attempts. Nothing outside the probe's own rows is touched.
import 'dotenv/config';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import pg from 'pg';

const TRIES = Number(process.argv[2] || 50);
const PORT = Number(process.argv[3] || 3999);
const BASE = `http://127.0.0.1:${PORT}`;

const stamp = Date.now();
const KNOWN = `timing-known-${stamp}@example.com`;
const UNKNOWN = `timing-unknown-${stamp}@example.com`;
const PASS = 'Str0ng!Passw0rd!';

// ─── Start the server ────────────────────────────────────────────────────────
const server = spawn(process.execPath, ['src/server.js'], {
  env: {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: 'test',
    // The measurement needs many requests; the production budgets would 429
    // long before 50 tries.
    AUTH_RATE_LIMIT_SIGNIN_MAX: '5000',
    AUTH_RATE_LIMIT_FORGOT_MAX: '5000',
    AUTH_RATE_LIMIT_RESET_MAX: '5000',
    AUTH_RATE_LIMIT_SIGNUP_MAX: '5000',
    RATE_LIMIT_API_MAX: '50000',
    RATE_LIMIT_LLM_MAX: '5000',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', () => {});
server.stderr.on('data', (d) => {
  const s = String(d);
  if (!/SECURITY WARNING|libpq|sslmode|trace-warnings/i.test(s)) process.stderr.write(s);
});

const stop = () => { try { server.kill(); } catch { /* already gone */ } };
process.on('exit', stop);

for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(`${BASE}/health`);
    if (r.ok) break;
  } catch { /* not up yet */ }
  await sleep(500);
}

// ─── Direct DB access (only for the probe's own rows) ───────────────────────
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const clearLockout = async () => {
  await pool.query('DELETE FROM auth_attempts WHERE email = ANY($1)', [[KNOWN, UNKNOWN]]);
};
const clearOtps = async () => {
  await pool.query('DELETE FROM otps WHERE email = ANY($1)', [[KNOWN, UNKNOWN]]);
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const timed = async (path, body, headers = {}) => {
  const started = process.hrtime.bigint();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  return { ms, status: res.status, body: text };
};

// The per-request id differs on every response by design, so it is masked
// before bodies are compared for equality.
const maskBody = (body) => body
  .replace(/"requestId":"[^"]*"/g, '"requestId":"#"')
  .replace(/"dev_otp":"\d{6}"/g, '"dev_otp":"######"');

const stats = (xs) => {
  const sorted = [...xs].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return {
    n: sorted.length,
    min: +sorted[0].toFixed(1),
    p50: +q(0.5).toFixed(1),
    p95: +q(0.95).toFixed(1),
    max: +sorted[sorted.length - 1].toFixed(1),
    mean: +mean.toFixed(1),
  };
};

// A perfect oracle: a single threshold that separates the two populations.
const separability = (a, b) => {
  const as = [...a].sort((x, y) => x - y);
  const bs = [...b].sort((x, y) => x - y);
  const aMax = as[as.length - 1];
  const aMin = as[0];
  const bMax = bs[bs.length - 1];
  const bMin = bs[0];
  if (aMin > bMax) return { separable: true, direction: 'known is always slower', threshold: (aMin + bMax) / 2 };
  if (bMin > aMax) return { separable: true, direction: 'unknown is always slower', threshold: (bMin + aMax) / 2 };
  // Overlap: count how many of each side a best single threshold would
  // misclassify.
  let best = { errors: Infinity, threshold: null };
  for (const t of [...as, ...bs]) {
    const errors = as.filter((v) => v >= t).length + bs.filter((v) => v < t).length;
    if (errors < best.errors) best = { errors, threshold: t };
  }
  return {
    separable: false,
    best_threshold_errors: `${best.errors}/${as.length + bs.length}`,
    overlap_ms: +(Math.min(aMax, bMax) - Math.max(aMin, bMin)).toFixed(1),
  };
};

const report = (name, known, unknown, extra = {}) => {
  const sep = separability(known, unknown);
  console.log(`\n=== ${name} (${TRIES} tries each) ===`);
  console.log(`  known   : ${JSON.stringify(stats(known))}`);
  console.log(`  unknown : ${JSON.stringify(stats(unknown))}`);
  console.log(`  delta   : p50 ${(stats(known).p50 - stats(unknown).p50).toFixed(1)}ms`);
  console.log(`  oracle  : ${JSON.stringify(sep)}`);
  if (extra.body !== undefined) console.log(`  bodies  : ${extra.body}`);
  return sep;
};

// ─── 0. one throwaway account ───────────────────────────────────────────────
const signup = await fetch(`${BASE}/auth/signup`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'Timing Probe', email: KNOWN, password: PASS }),
});
if (!signup.ok) {
  console.error('signup failed', signup.status, await signup.text());
  stop();
  await pool.end();
  process.exit(1);
}

// ─── 1. signin: known account vs unknown account ────────────────────────────
const signinKnown = [];
const signinUnknown = [];
let signinBodies = new Set();
for (let i = 0; i < TRIES; i++) {
  await clearLockout();
  const k = await timed('/auth/signin', { email: KNOWN, password: 'WrongPassw0rd!' });
  signinKnown.push(k.ms);
  signinBodies.add(`${k.status}:${maskBody(k.body)}`);

  await clearLockout();
  const u = await timed('/auth/signin', { email: UNKNOWN, password: 'WrongPassw0rd!' });
  signinUnknown.push(u.ms);
  signinBodies.add(`${u.status}:${maskBody(u.body)}`);
}
const signinSep = report('POST /auth/signin', signinKnown, signinUnknown, {
  body: `identical bodies: ${signinBodies.size === 2 ? 'yes' : `NO (${signinBodies.size} variants)`}`,
});

// ─── 2. forgot-password: known account vs unknown account ───────────────────
const forgotKnown = [];
const forgotUnknown = [];
const forgotBodies = new Set();
for (let i = 0; i < TRIES; i++) {
  await clearOtps();
  const k = await timed('/auth/forgot-password', { email: KNOWN });
  forgotKnown.push(k.ms);
  forgotBodies.add(`${k.status}:${maskBody(k.body)}`);

  await clearOtps();
  const u = await timed('/auth/forgot-password', { email: UNKNOWN });
  forgotUnknown.push(u.ms);
  forgotBodies.add(`${u.status}:${maskBody(u.body)}`);
}
const forgotSep = report('POST /auth/forgot-password', forgotKnown, forgotUnknown, {
  body: `identical bodies (dev_otp masked): ${forgotBodies.size === 1 ? 'yes' : `NO (${forgotBodies.size} variants)`}`,
});

// ─── 3. reset-password: wrong code on a known account vs an unknown account ─
// Both have a code row (forgot-password issues one for either), so this
// measures the "wrong code" path against itself for a real vs a fake account.
const resetKnown = [];
const resetUnknown = [];
const resetBodies = new Set();
for (let i = 0; i < TRIES; i++) {
  await clearOtps();
  await timed('/auth/forgot-password', { email: KNOWN });
  const k = await timed('/auth/reset-password', { email: KNOWN, otp: '000000', new_password: 'An0therPassw0rd!' });
  resetKnown.push(k.ms);
  resetBodies.add(`${k.status}:${maskBody(k.body)}`);

  await clearOtps();
  await timed('/auth/forgot-password', { email: UNKNOWN });
  const u = await timed('/auth/reset-password', { email: UNKNOWN, otp: '000000', new_password: 'An0therPassw0rd!' });
  resetUnknown.push(u.ms);
  resetBodies.add(`${u.status}:${maskBody(u.body)}`);
}
const resetSep = report('POST /auth/reset-password (wrong code)', resetKnown, resetUnknown, {
  body: `identical bodies: ${resetBodies.size === 1 ? 'yes' : `NO (${resetBodies.size} variants)`}`,
});

// ─── 4. reset-password: no code row at all (the "missing" path) ─────────────
const missing = [];
for (let i = 0; i < TRIES; i++) {
  await clearOtps();
  const m = await timed('/auth/reset-password', { email: UNKNOWN, otp: '000000', new_password: 'An0therPassw0rd!' });
  missing.push(m.ms);
}
const mismatch = resetKnown;
console.log(`\n=== POST /auth/reset-password: no code row vs wrong code (${TRIES} each) ===`);
console.log(`  no code  : ${JSON.stringify(stats(missing))}`);
console.log(`  wrong code: ${JSON.stringify(stats(mismatch))}`);
const missingSep = separability(missing, mismatch);
console.log(`  oracle  : ${JSON.stringify(missingSep)}`);

// ─── 5. cleanup: remove every row this probe created ─────────────────────────
await clearOtps();
await clearLockout();
await pool.query('DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email = $1)', [KNOWN]);
await pool.query('DELETE FROM users WHERE email = ANY($1)', [[KNOWN, UNKNOWN]]);
const { rows: left } = await pool.query('SELECT count(*)::int AS c FROM users WHERE email = ANY($1)', [[KNOWN, UNKNOWN]]);
console.log(`\ncleanup: probe rows left in users = ${left[0].c}`);

await pool.end();
stop();

const verdicts = [signinSep, forgotSep, resetSep, missingSep];
const oracleFree = verdicts.every((v) => !v.separable);
console.log(`\nVERDICT: ${oracleFree ? 'no timing oracle separates known from unknown on any measured path' : 'A TIMING ORACLE REMAINS'}`);
process.exit(oracleFree ? 0 : 1);
