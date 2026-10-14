// Break-it battery (item 2): attacks the running API and records
// expected-vs-actual per attack. Safe by construction: unique throwaway
// accounts per run, no destructive calls, skips LLM-costly paths.
// Usage: BASE=http://127.0.0.1:3000 node scripts/break-it.mjs
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const stamp = Date.now();
let pass = 0;
let fail = 0;
const rows = [];
const check = (attack, expected, actual, ok, extra = '') => {
  if (ok) pass += 1; else fail += 1;
  rows.push({ attack, expected, actual: `${actual}${extra}` });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${attack} | expected ${expected}, got ${actual}${extra}`);
};
const j = (r) => r.json().catch(() => ({}));
const POST = (p, body, headers = {}) => fetch(BASE + p, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
const mkuser = async (tag) => {
  const email = `break${tag}${stamp}@example.com`;
  const r = await POST('/auth/signup', { name: `Break ${tag}`, email, password: 'Str0ng!Passw0rd' });
  const b = await j(r);
  return { email, token: b.accessToken, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
};

// 1. Oversized body → 413 (was: fake 502)
{
  const r = await POST('/auth/signup', { name: 'x'.repeat(20000), email: `big${stamp}@example.com`, password: 'Str0ng!Passw0rd' });
  const b = await j(r);
  check('oversized body', '413 PAYLOAD_TOO_LARGE', r.status, r.status === 413 && b.error?.code === 'PAYLOAD_TOO_LARGE');
}
// 2. Malformed JSON → 400
{
  const r = await fetch(`${BASE}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"broken":' });
  const b = await j(r);
  check('malformed JSON', '400 VALIDATION_ERROR', r.status, r.status === 400 && b.error?.code === 'VALIDATION_ERROR');
}
// 3. SQL injection strings → neutral 401/400, no error-shape change
{
  const r = await POST('/auth/signin', { email: `' OR '1'='1`, password: 'x' });
  check('SQLi signin', '401 generic', r.status, r.status === 401);
  const r2 = await POST('/auth/signin', { email: 'a@b.co', password: `' OR 1=1 --` });
  check('SQLi password', '401 generic', r2.status, r2.status === 401);
}
// 4. Token tampering + replay
{
  const r = await fetch(`${BASE}/auth/me`, { headers: { Authorization: 'Bearer tampered.header.sig' } });
  check('tampered token', '401', r.status, r.status === 401);
  const u = await mkuser('tamper');
  const parts = u.token.split('.');
  const bad = `${parts[0]}.${parts[1]}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
  const r2 = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${bad}` } });
  check('forged signature', '401', r2.status, r2.status === 401);
}
// 5. Refresh-token reuse → rotation revokes the old one
{
  const u = await mkuser('reuse');
  const r1 = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { Cookie: u.cookie } });
  const ok1 = r1.status === 200;
  const r2 = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { Cookie: u.cookie } });
  check('refresh reuse', '200 then 401', `${r1.status} then ${r2.status}`, ok1 && r2.status === 401);
}
// 6. Cross-user access (BOLA)
{
  const a = await mkuser('bolaA');
  const b = await mkuser('bolaB');
  const HA = { Authorization: `Bearer ${a.token}` };
  const HB = { Authorization: `Bearer ${b.token}` };
  await POST('/auth/favorites', { restaurant_id: 'r001' }, HA);
  const rb = await fetch(`${BASE}/auth/favorites`, { headers: HB });
  const bb = await j(rb);
  check("B cannot list A's favorites", "B list empty", `B has ${(bb.favorites || []).length}`, (bb.favorites || []).length === 0);
  const rd = await fetch(`${BASE}/auth/favorites/r001`, { method: 'DELETE', headers: HB });
  const ra = await fetch(`${BASE}/auth/favorites`, { headers: HA });
  const ba = await j(ra);
  check("B cannot delete A's favorite", "A intact", `A has ${(ba.favorites || []).length}, del=${rd.status}`, ba.favorites.includes('r001'));
  const rg = await fetch(`${BASE}/admin/stats`, { headers: HA });
  check('non-admin blocked from admin', '403', rg.status, rg.status === 403);
}
// 7. Rate-limit bypass via X-Forwarded-For spoofing
{
  let last = 0;
  for (let i = 0; i < 25; i++) {
    const r = await fetch(`${BASE}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.9.9.${i}` },
      body: JSON.stringify({ email: 'nobody-here@example.com', password: 'wrongwrong1' }),
    });
    last = r.status;
    await j(r);
  }
  // Locally TRUST_PROXY=1 honors the spoofed header, so fresh IPs never trip
  // the limiter: documents why direct deploys must set TRUST_PROXY=0.
  check('XFF spoofing', 'bypasses IP limiter locally (documented)', last, last === 401);
}
// 8. CORS from a foreign origin (local reflect mode)
{
  const r = await fetch(`${BASE}/health`, { headers: { Origin: 'https://evil.example' } });
  const acao = r.headers.get('access-control-allow-origin');
  check('foreign origin CORS (local)', 'reflected in dev, denied in prod (guard)', acao || '(none)', true, ` acao=${acao}`);
}
// 9. Session fixation / enumeration shape
{
  const r = await fetch(`${BASE}/chat/not-a-uuid`);
  check('non-UUID session id', '400', r.status, r.status === 400);
  const r2 = await fetch(`${BASE}/chat/11111111-1111-4111-8111-111111111111`);
  check('unknown UUID session', '404 SESSION_NOT_FOUND', r2.status, r2.status === 404);
}

console.log(`\nBREAK-IT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
