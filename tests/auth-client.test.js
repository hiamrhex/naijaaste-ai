import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

const memStore = {};
globalThis.localStorage = {
  getItem: (k) => (k in memStore ? memStore[k] : null),
  setItem: (k, v) => { memStore[k] = String(v); },
  removeItem: (k) => { delete memStore[k]; },
};

describe('security headers + token storage (item 4)', () => {
  it('serves a strict CSP plus hardening headers', async () => {
    const res = await request(app).get('/health').expect(200);
    const csp = res.headers['content-security-policy'] || '';
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).not.toContain('unsafe-inline https://accounts.google.com');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('access token never touches localStorage; refresh rehydrates it', async () => {
    const seen = [];
    globalThis.fetch = vi.fn(async (url) => {
      seen.push(String(url));
      if (String(url).endsWith('/auth/refresh')) {
        return {
          ok: true,
          headers: { get: () => null },
          json: async () => ({ user: { id: 'u1', email: 'a@b.co' }, accessToken: 'fresh-tok' }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ data: { ok: true } }),
      };
    });

    // Stored session from a previous visit: user only, no token.
    memStore['naijataste.auth'] = JSON.stringify({ user: { id: 'u1', email: 'a@b.co' } });
    const auth = await import('../src/lib/auth.js?csp-token-test');
    expect(auth.getAuth()?.accessToken).toBeUndefined();

    const res = await auth.authFetch('/auth/me');
    expect(res.ok).toBe(true);
    const meCall = globalThis.fetch.mock.calls.find(([u]) => String(u).endsWith('/auth/me'));
    expect(meCall[1].headers.Authorization).toBe('Bearer fresh-tok');
    // Storage still token-free after the whole flow.
    expect(memStore['naijataste.auth']).not.toContain('fresh-tok');
    expect(auth.getAuth()?.accessToken).toBe('fresh-tok');

    // setAuth strips tokens before persisting.
    const { setAuth } = auth;
    setAuth({ user: { id: 'u1' }, accessToken: 'tok-zzz' });
    expect(memStore['naijataste.auth']).not.toContain('tok-zzz');
  });
});
