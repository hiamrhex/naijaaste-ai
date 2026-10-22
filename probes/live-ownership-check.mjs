// Live check of the chat-session ownership rules on the deployment.
const BASE = 'https://naijataste-ai.vercel.app';

const post = async (path, body, token) => {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, json, requestId: res.headers.get('x-request-id') };
};

const get = async (path, token) => {
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, json, requestId: res.headers.get('x-request-id') };
};

const del = async (path, token) => {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, json, requestId: res.headers.get('x-request-id') };
};

const out = (label, r) => console.log(
  `${label.padEnd(46)} ${String(r.status).padEnd(4)} code=${r.json?.error?.code ?? '-'} reqId=${r.requestId ? 'yes' : 'no'}`
);

// A second, different account.
const stamp = Date.now();
const accA = { name: 'Owner A', email: `ownera-${stamp}@example.com`, password: 'Str0ng!Passw0rd!' };
const accB = { name: 'Owner B', email: `ownerb-${stamp}@example.com`, password: 'Str0ng!Passw0rd!' };
const signupA = await post('/api/v1/auth/signup', accA);
const signupB = await post('/api/v1/auth/signup', accB);
const tokenA = signupA.json?.accessToken;
const tokenB = signupB.json?.accessToken;
console.log(`signup A: ${signupA.status}  signup B: ${signupB.status}`);

// A's session.
const created = await post('/api/v1/chat', { message: 'I want jollof in Lagos' }, tokenA);
const sid = created.json?.session_id;
console.log(`A created session: ${created.status} ${sid}`);
const capability = created.json?.session_capability;

out('A reads own session', await get(`/api/v1/chat/${sid}`, tokenA));
out('B reads A session (must be 404)', await get(`/api/v1/chat/${sid}`, tokenB));
out('anonymous reads A session (must be 404)', await get(`/api/v1/chat/${sid}`));
out('B deletes A session (must be 404)', await del(`/api/v1/chat/${sid}`, tokenB));
out('A session still there (200)', await get(`/api/v1/chat/${sid}`, tokenA));

// Anonymous session: capability only.
const anon = await post('/api/v1/chat', { message: 'anonymous jollof please' });
const anonSid = anon.json?.session_id;
const anonCap = anon.json?.session_capability;
console.log(`anonymous session: ${anon.status} ${anonSid}`);
out('anonymous read without capability (404)', await get(`/api/v1/chat/${anonSid}`));
out('anonymous read with capability (200)', await get(`/api/v1/chat/${anonSid}`, anonCap));
out('B deletes anonymous session (404)', await del(`/api/v1/chat/${anonSid}`, tokenB));
out('capability deletes anonymous session (200)', await del(`/api/v1/chat/${anonSid}`, anonCap));

// The agent path (what the SPA uses).
const agent = await post('/api/v1/agent', { message: 'Where can I eat jollof in Lagos?' }, tokenA);
console.log(`\nPOST /api/v1/agent -> ${agent.status} fallback=${agent.json?.meta?.fallback ?? false} steps=${agent.json?.meta?.steps ?? '-'}`);
console.log(`  message: ${String(agent.json?.message || '').slice(0, 120)}`);

// Clean up: delete both probe accounts.
for (const t of [tokenA, tokenB]) {
  if (t) { const r = await del('/api/v1/auth/me', t); console.log(`cleanup DELETE /api/v1/auth/me -> ${r.status}`); }
}
