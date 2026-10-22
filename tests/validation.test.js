import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'child_process';
import request from 'supertest';
import { app } from '../src/app.js';
import {
  chatBodySchema,
  extractPersonaSchema,
  updatePreferenceSchema,
  MIN_RAW_TEXT,
} from '../src/schemas/index.js';

describe('request schemas (layer 2)', () => {
  it('chat: accepts a plain message, trims it', () => {
    const r = chatBodySchema.safeParse({ message: '  hello  ' });
    expect(r.success).toBe(true);
    expect(r.data.message).toBe('hello');
  });

  it('chat: rejects empty, non-string, and >500-char messages', () => {
    expect(chatBodySchema.safeParse({}).success).toBe(false);
    expect(chatBodySchema.safeParse({ message: 123 }).success).toBe(false);
    expect(chatBodySchema.safeParse({ message: 'x'.repeat(501) }).success).toBe(false);
  });

  it('chat: rejects malformed session_id', () => {
    expect(chatBodySchema.safeParse({ message: 'hi', session_id: 'not-a-uuid' }).success).toBe(false);
    expect(chatBodySchema.safeParse({ message: 'hi', session_id: '11111111-1111-4111-8111-111111111111' }).success).toBe(true);
  });

  it(`extract-persona: enforces MIN_RAW_TEXT (${MIN_RAW_TEXT})`, () => {
    expect(extractPersonaSchema.safeParse({ raw_text: 'short' }).success).toBe(false);
    expect(extractPersonaSchema.safeParse({ raw_text: 'x'.repeat(MIN_RAW_TEXT) }).success).toBe(true);
  });

  it('update-preference: rating must be an integer 1-5 (4.5 rejected)', () => {
    const base = { persona: { preference_history: [] }, signal: { dimension: 'spice', value: 'hot', rating: 4.5 } };
    expect(updatePreferenceSchema.safeParse(base).success).toBe(false);
    expect(updatePreferenceSchema.safeParse({ ...base, signal: { ...base.signal, rating: 4 } }).success).toBe(true);
    expect(updatePreferenceSchema.safeParse({ ...base, signal: { ...base.signal, rating: 6 } }).success).toBe(false);
  });
});

describe('HTTP validation failures use the 003 contract', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app).post('/auth/signup').send({
      name: 'Test User',
      email: `test${Date.now()}@example.com`,
      password: 'Str0ng!Passw0rd',
    });
    token = res.body.accessToken;
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('POST /chat with non-string message → 400 VALIDATION_ERROR + details path', async () => {
    const res = await request(app).post('/chat').set(auth()).send({ message: 42 }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details?.[0]?.path).toBe('message');
  });

  it('POST /extract-persona with short raw_text → 400 with path raw_text', async () => {
    const res = await request(app).post('/extract-persona').set(auth()).send({ raw_text: 'no' }).expect(400);
    expect(res.body.error.details?.[0]?.path).toBe('raw_text');
  });

  it('POST /recommend missing persona → 400 with path persona', async () => {
    const res = await request(app).post('/recommend').set(auth()).send({}).expect(400);
    expect(res.body.error.details?.[0]?.path).toBe('persona');
  });

  it('POST /update-preference with rating 4.5 → 400 (integer enforced)', async () => {
    const res = await request(app)
      .post('/update-preference')
      .set(auth())
      .send({ persona: { preference_history: [] }, signal: { dimension: 'spice', value: 'hot', rating: 4.5 } })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('fail-fast env (layer 18)', () => {
  it('exits 1 with a field-level message when GEMINI_API_KEY is empty', () => {
    let out = '';
    let status = 0;
    try {
      execFileSync(process.execPath, ['src/server.js'], {
        cwd: process.cwd(),
        env: { ...process.env, GEMINI_API_KEY: '' },
        stdio: 'pipe',
      });
    } catch (e) {
      status = e.status;
      out = String(e.stderr);
    }
    expect(status).toBe(1);
    expect(out).toContain('GEMINI_API_KEY');
    expect(out).not.toContain(process.env.GEMINI_API_KEY); // never echo the real value
  });
});