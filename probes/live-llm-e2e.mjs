// End-to-end probe against the REAL Gemini key and the real Neon DB.
// Exercises the exact endpoints the app uses: POST /api/v1/chat and
// POST /agent (the frontend chat path). Prints status + timing only.
import 'dotenv/config';
import request from 'supertest';

const { app } = await import('../src/app.js');
const { closePool } = await import('../src/db/pool.js');

const probe = async (label, run) => {
  const started = Date.now();
  try {
    const res = await run();
    const body = res.body || {};
    console.log(JSON.stringify({
      label,
      status: res.status,
      ms: Date.now() - started,
      content_type: res.headers['content-type'] || null,
      request_id: res.headers['x-request-id'] || body?.requestId || body?.error?.requestId || null,
      success: body.success ?? null,
      code: body?.error?.code ?? null,
      fallback: body?.meta?.fallback ?? body?.fallback ?? null,
      model_used: body?.meta?.model ?? null,
      message: String(body?.message || body?.error?.message || '').slice(0, 180),
      recs: body?.recommendations?.recommendations?.length ?? null,
    }));
    return res;
  } catch (err) {
    console.log(JSON.stringify({ label, ms: Date.now() - started, thrown: String(err?.message || err).slice(0, 200) }));
    return null;
  }
};

await probe('chat', () =>
  request(app)
    .post('/api/v1/chat')
    .send({ message: 'Student in Lagos, tight budget, love pepper soup' })
);

// The frontend path: /agent (authenticated).
const email = `probe${Date.now()}@example.com`;
const signup = await request(app)
  .post('/auth/signup')
  .send({ name: 'LLM Probe', email, password: 'Str0ng!Passw0rd' });
const token = signup.body?.accessToken;

if (token) {
  await probe('agent', () =>
    request(app)
      .post('/agent')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Where can I get jollof rice in Lagos under 5000 naira?' })
  );

  // Clean up the throwaway account.
  await request(app).delete('/auth/me').set('Authorization', `Bearer ${token}`);
}

await closePool();
