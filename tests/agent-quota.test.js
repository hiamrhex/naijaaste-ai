import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// One agent turn may charge ONE quota unit. The limit is set to 1 before the
// app (and llm-quota.service, which reads env at module load) is imported.
vi.hoisted(() => {
  process.env.LLM_MONTHLY_MAX = '1';
  process.env.RATE_LIMIT_LLM_MAX = '500';
  process.env.RATE_LIMIT_API_MAX = '5000';
});

// The model itself is irrelevant here: the quota check happens before the loop.
vi.mock('../src/agent/agent.js', () => ({
  runAgent: async () => ({ text: 'mocked reply', trace: [] }),
}));

import { verifiedToken } from './helpers/session.js';

const { app } = await import('../src/app.js');

const stamp = Date.now();

const signup = async () => verifiedToken(app, `agentquota${stamp}@example.com`, { name: 'Quota Tester' });

const auth = (t) => ({ Authorization: `Bearer ${t}` });

describe('POST /agent monthly quota', () => {
  it('charges a turn and answers 429 when the monthly quota is spent', async () => {
    const token = await signup();

    const first = await request(app)
      .post('/api/v1/agent')
      .set(auth(token))
      .send({ message: 'Spicy amala in Yaba' });
    expect(first.status).toBe(200);
    expect(first.body.success).toBe(true);

    const second = await request(app)
      .post('/api/v1/agent')
      .set(auth(token))
      .send({ message: 'Same again please' });

    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe('LLM_QUOTA_EXCEEDED');
    expect(second.headers['retry-after']).toBeDefined();
    expect(second.body.error.requestId).toBeDefined();
  });
});
