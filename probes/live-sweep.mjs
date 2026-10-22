// Item 7: the live check sweep.
//
// One request per check, all against the deployment. Prints status, the
// content type, the request id and whether the body was JSON.
import { writeFileSync } from 'fs';

const BASE = 'https://naijataste-ai.vercel.app';
const TMP = process.env.TEMP || process.env.TMPDIR;

const send = async (method, path, { body, token, headers = {} } = {}) => {
  const init = { method, headers: { ...headers } };
  if (token) init.headers.authorization = `Bearer ${token}`;
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let json = null;
  let isJson = false;
  try { json = JSON.parse(text); isJson = true; } catch { /* not JSON */ }
  return {
    status: res.status,
    contentType: res.headers.get('content-type'),
    requestId: res.headers.get('x-request-id'),
    isJson,
    json,
    text: text.slice(0, 120),
  };
};

const line = (label, r, extra = '') =>
  console.log(
    `${label.padEnd(42)} ${String(r.status).padEnd(4)} ${(r.contentType || '-').split(';')[0].padEnd(24)} ` +
    `reqId=${r.requestId ? 'yes' : 'NO '} json=${r.isJson ? 'yes' : 'NO '} ${extra}`
  );

console.log(`# live sweep → ${BASE}\n`);

// 1. Documents and headers.
for (const p of ['/', '/app/login', '/sw.js', '/offline.html', '/offline.js']) {
  const r = await send('GET', p);
  const h = (await fetch(`${BASE}${p}`, { method: 'HEAD' })).headers;
  const present = ['content-security-policy', 'x-frame-options', 'x-content-type-options',
    'referrer-policy', 'permissions-policy'].filter((k) => h.get(k)).length;
  line(`GET ${p}`, r, `security-headers=${present}/5`);
}

// 2. API surface.
for (const p of ['/health', '/api/health', '/health/ready']) {
  line(`GET ${p}`, await send('GET', p));
}
line('GET /api/v1/nearby', await send('GET', '/api/v1/nearby?lat=6.5095&lng=3.3711&limit=3'));
line('GET /api/v1/restaurants/geo', await send('GET', '/api/v1/restaurants/geo?ids=r001,r002'));
line('GET /api/v1/chat/<uuid> (no auth)', await send('GET', '/api/v1/chat/11111111-1111-4111-8111-111111111111'));
line('GET /api/v1/chat/<uuid> (bad uuid)', await send('GET', '/api/v1/chat/not-a-uuid'));
line('GET /api/v1/admin/stats (no auth)', await send('GET', '/api/v1/admin/stats'));

// 3. A body-carrying request (the case that used to 500).
line('POST /api/v1/nonexistent (json body)', await send('POST', '/api/v1/nonexistent', { body: { a: 1 } }));
line('POST /api/v1/nonexistent (no body)', await send('POST', '/api/v1/nonexistent'));
line('POST /api/v1/nonexistent (malformed)', await send('POST', '/api/v1/nonexistent', { body: '{bad' }));
line('POST /api/v1/nonexistent (text/plain)', await send('POST', '/api/v1/nonexistent', { body: 'x', headers: { 'content-type': 'text/plain' } }));

// 4. The auth flow end to end.
const stamp = Date.now();
const email = `sweep-${stamp}@example.com`;
const signup = await send('POST', '/api/v1/auth/signup', { body: { name: 'Sweep', email, password: 'Str0ng!Passw0rd!' } });
line('POST /api/v1/auth/signup', signup, `user=${signup.json?.user?.id ?? '-'}`);
const token = signup.json?.accessToken;
line('POST /api/v1/auth/signin', await send('POST', '/api/v1/auth/signin', { body: { email, password: 'Str0ng!Passw0rd!' } }));
line('GET /api/v1/auth/me (with token)', await send('GET', '/api/v1/auth/me', { token }));
line('POST /api/v1/auth/signin (wrong password)', await send('POST', '/api/v1/auth/signin', { body: { email, password: 'wrongwrongwrong' } }));

// 5. The LLM path (subject to the 10/min budget).
line('POST /api/v1/chat', await send('POST', '/api/v1/chat', { body: { message: 'Jollof in Lagos, tight budget' } }));
line('POST /api/v1/recommend', await send('POST', '/api/v1/recommend', {
  body: {
    persona: {
      persona_id: 'sweep', city: 'Lagos', budget_level: 'budget', spice_tolerance: 'hot',
      ambience_preference: 'casual_dining', preferred_cuisines: ['Street Food'], dietary_flags: ['none'],
    },
  },
}));

// 6. Cleanup the probe account.
line('DELETE /api/v1/auth/me (cleanup)', await send('DELETE', '/api/v1/auth/me', { token }));
