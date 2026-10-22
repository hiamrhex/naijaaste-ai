import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import request from 'supertest';
import { app } from '../src/app.js';
import {
  ApiError, ValidationError, UnauthorizedError, ForbiddenError,
  NotFoundError, ConflictError, RateLimitedError, UpstreamError,
  UnavailableError, isApiError,
} from '../src/lib/errors.js';
import { ok, fail } from '../src/lib/respond.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('contract group (layers 19/20/25/26/27)', () => {
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

  it('v1 and legacy paths serve identical handlers', async () => {
    const v1 = await request(app).post('/api/v1/chat').set(auth()).send({}).expect(400);
    const legacy = await request(app).post('/chat').set(auth()).send({}).expect(400);
    expect(v1.body.error.code).toBe('VALIDATION_ERROR');
    expect(legacy.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('v1 auth validation matches legacy', async () => {
    const res = await request(app).post('/api/v1/auth/signup').send({}).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('error shape is exactly { error: { code, message, details?, requestId } }', async () => {
    const res = await request(app).post('/api/v1/recommend').send({}).expect(400);
    expect(Object.keys(res.body)).toEqual(['error']);
    for (const k of Object.keys(res.body.error)) {
      expect(['code', 'message', 'details', 'requestId']).toContain(k);
    }
    expect(res.body.error.requestId).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  it('AppError subclasses carry the specified status codes', () => {
    expect(new ValidationError('x').status).toBe(400);
    expect(new UnauthorizedError().status).toBe(401);
    expect(new ForbiddenError().status).toBe(403);
    expect(new NotFoundError().status).toBe(404);
    expect(new ConflictError().status).toBe(409);
    expect(new RateLimitedError('x', 60).status).toBe(429);
    expect(new RateLimitedError('x', 60).retryAfterSec).toBe(60);
    expect(new UpstreamError().status).toBe(502);
    expect(new UnavailableError().status).toBe(503);
    expect(isApiError(new ValidationError('x'))).toBe(true);
    expect(isApiError(new Error('x'))).toBe(false);
    expect(new ApiError(418, 'TEAPOT', 'short').code).toBe('TEAPOT');
  });

  it('ok() emits { data, meta? } and fail() emits the error shape + Retry-After', () => {
    const mk = () => {
      const r = { statusCode: 0, headers: {}, body: null };
      r.status = (c) => { r.statusCode = c; return r; };
      r.set = (k, v) => { r.headers[k] = v; return r; };
      r.json = (b) => { r.body = b; return r; };
      return r;
    };
    const r1 = mk();
    ok(r1, { a: 1 }, { page: 2 }, 201);
    expect(r1.statusCode).toBe(201);
    expect(r1.body).toEqual({ data: { a: 1 }, meta: { page: 2 } });

    const r2 = mk();
    ok(r2, [1]);
    expect(r2.body).toEqual({ data: [1] });

    const r3 = mk();
    fail(r3, { status: 429, code: 'RATE_LIMITED', message: 'slow', requestId: 'r', retryAfterSec: 60 });
    expect(r3.headers['Retry-After']).toBe('60');
    expect(r3.body).toEqual({ error: { code: 'RATE_LIMITED', message: 'slow', requestId: 'r' } });
  });

  it('vercel.json routes /api/* to the function with maxDuration 60', () => {
    const cfg = JSON.parse(readFileSync(join(__dirname, '..', 'vercel.json'), 'utf-8'));
    expect(cfg.functions['api/index.js'].maxDuration).toBe(60);
    expect(cfg.rewrites.some((r) => r.source.startsWith('/api/'))).toBe(true);
  });

  it('vercel.json serves the SPA shell under /app (landing owns /)', () => {
    const cfg = JSON.parse(readFileSync(join(__dirname, '..', 'vercel.json'), 'utf-8'));
    const dests = cfg.rewrites.map((r) => `${r.source} -> ${r.destination}`);
    expect(dests).toContain('/app -> /app/index.html');
    expect(dests).toContain('/app/:path* -> /app/index.html');
    // No catch-all may swallow the API or the landing page.
    expect(cfg.rewrites.some((r) => r.source === '/(.*)')).toBe(false);
  });

  it('api/index.js default-exports a function handler without listening', async () => {
    const mod = await import('../api/index.js');
    expect(typeof mod.default).toBe('function');
    // Strip + dispatch behavior is covered in tests/serverless.test.js.
  });
});
