import { describe, it, expect, afterEach } from 'vitest';
import { env } from '../src/env.js';
import {
  initMonitoring,
  monitoringEnabled,
  redactHeaders,
  redactEvent,
  redactTags,
  stripQuery,
  captureException,
  __setClientForTests,
} from '../src/lib/monitoring.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

afterEach(() => __setClientForTests(null));

describe('monitoring (Sentry hook)', () => {
  it('is a quiet no-op without SENTRY_DSN (nothing enabled, no network send)', async () => {
    const wasEnabled = await initMonitoring();
    expect(wasEnabled).toBe(false);
    expect(monitoringEnabled()).toBe(false);
    // Must not throw when capturing with no client attached.
    expect(() => captureException(new Error('boom'))).not.toThrow();
  });

  it('SENTRY_DSN env contract validates as optional string', () => {
    // env.js parsed successfully either way; the key exists in the schema.
    expect('SENTRY_DSN' in env === false || typeof env.SENTRY_DSN === 'string').toBe(true);
  });

  it('redactHeaders strips authorization and cookies, keeps the rest', () => {
    const clean = redactHeaders({
      Authorization: 'Bearer highly_secret',
      authorization: 'Bearer also_secret',
      Cookie: 'refreshToken=also_highly_secret',
      'set-cookie': 'x=1',
      'proxy-authorization': 'nope',
      'content-type': 'application/json',
      'x-request-id': 'keep-me',
    });
    expect(clean['content-type']).toBe('application/json');
    expect(clean['x-request-id']).toBe('keep-me');
    expect(Object.keys(clean)).not.toContain('Authorization');
    expect(Object.keys(clean)).not.toContain('authorization');
    expect(Object.keys(clean)).not.toContain('Cookie');
    expect(Object.keys(clean)).not.toContain('set-cookie');
    expect(Object.keys(clean)).not.toContain('proxy-authorization');
    expect(JSON.stringify(clean)).not.toContain('secret');
    expect(JSON.stringify(clean)).not.toContain('refreshToken');
  });

  it('redactEvent strips cookies/auth headers and masks auth-shaped body fields', () => {
    const event = {
      request: {
        headers: { authorization: 'Bearer top_secret', 'x-request-id': 'keep' },
        cookies: { refreshToken: 'super_secret' },
        data: { email: 'a@b.c', password: 'hunter2secret', nested: { refreshToken: 'leak-me-no' }, keep: 'visible' },
      },
    };
    const out = redactEvent(event);
    expect(JSON.stringify(out)).not.toContain('top_secret');
    expect(JSON.stringify(out)).not.toContain('super_secret');
    expect(JSON.stringify(out)).not.toContain('hunter2');
    expect(JSON.stringify(out)).not.toContain('leak-me');
    expect(JSON.stringify(out)).toContain('visible');
    expect(JSON.stringify(out)).not.toContain('"email":"a@b.c"'); // PII: the address never leaves
    expect(JSON.stringify(out)).toContain('[REDACTED_EMAIL]');
  });

  it('stripQuery keeps the path and drops the query string', () => {
    expect(stripQuery('/api/v1/nearby?lat=6.52&lng=3.38&token=abc')).toBe('/api/v1/nearby');
    expect(stripQuery('https://x.test/app?x=1')).toBe('https://x.test/app');
    expect(stripQuery('/health')).toBe('/health');
  });

  it('redactTags strips url/path query strings and sensitive keys', () => {
    const out = redactTags({
      requestId: 'req-1',
      code: 'INTERNAL',
      url: '/api/v1/nearby?lat=6.52&lng=3.38&token=abc',
      path: '/api/nearby?lat=6.52&lng=3.38&token=abc',
      authorization: 'Bearer top_secret',
      email: 'ada@example.com',
    });
    expect(out.url).toBe('/api/v1/nearby');
    expect(out.path).toBe('/api/nearby');
    expect(out.authorization).toBe('[REDACTED]');
    expect(out.email).toBe('[REDACTED_EMAIL]');
    expect(out.requestId).toBe('req-1');
    expect(out.code).toBe('INTERNAL');
    expect(JSON.stringify(out)).not.toContain('6.52');
    expect(JSON.stringify(out)).not.toContain('top_secret');
    expect(JSON.stringify(out)).not.toContain('ada@example.com');
  });

  it('redactEvent strips request URL query, query_string, breadcrumbs and exception text', () => {
    const out = redactEvent({
      request: {
        url: 'https://x.test/api/v1/nearby?lat=6.52&lng=3.38&token=abc',
        query_string: 'lat=6.52&lng=3.38&token=abc',
      },
      tags: { url: '/nearby?lat=6.52&lng=3.38', path: '/nearby?token=abc' },
      breadcrumbs: [
        { message: 'GET /nearby?lat=6.52&lng=3.38&token=abc' },
        { data: { url: '/nearby?lat=6.52&lng=3.38', token: 'abc' } },
      ],
      exception: { values: [{ value: 'failed /nearby?lat=6.52&lng=3.38&token=abc' }] },
    });

    expect(out.request.url).toBe('https://x.test/api/v1/nearby');
    expect(out.request.query_string).toBeUndefined();
    expect(out.tags.url).toBe('/nearby');
    expect(out.tags.path).toBe('/nearby');

    const json = JSON.stringify(out);
    expect(json).not.toContain('6.52');
    expect(json).not.toContain('3.38');
    expect(json).not.toContain('abc');
    expect(json).not.toContain('token=abc');
    expect(json).toContain('[REDACTED]');
  });

  it('error path: /nearby lat/lng/token never reach the Sentry payload', () => {
    const sent = [];
    __setClientForTests({ captureException: (_err, context) => sent.push(context) });

    const req = {
      id: 'req-1',
      originalUrl: '/api/v1/nearby?lat=6.52&lng=3.38&token=abc',
      log: { error() {}, bindings: { name: 'naijataste-ai' } },
    };
    const res = { status() { return this; }, json() { return this; }, set() { return this; } };

    errorHandler(new Error('boom'), req, res, () => {});

    expect(sent).toHaveLength(1);
    const json = JSON.stringify(sent[0]);
    expect(json).not.toContain('6.52');
    expect(json).not.toContain('3.38');
    expect(json).not.toContain('abc');
    expect(json).not.toContain('token=');
    expect(sent[0].tags.requestId).toBe('req-1');
    expect(sent[0].tags.path).toBe('/api/v1/nearby');
    expect(sent[0].tags.code).toBe('INTERNAL');
  });
});
