import { describe, it, expect } from 'vitest';
import { env } from '../src/env.js';
import { initMonitoring, monitoringEnabled, redactHeaders, redactEvent, captureException } from '../src/lib/monitoring.js';

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
});
