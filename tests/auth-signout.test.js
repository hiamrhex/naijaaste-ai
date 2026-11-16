import { describe, it, expect, vi, beforeEach } from 'vitest';

// Signing out or deleting an account dropped the token but left the React
// layer's copy of the user. /login is GuestOnly, so it redirected the ghost
// back into the app, where every request failed with "Not authenticated".
// dropAuth() now announces the change and the provider clears its user.

const memStore = {};
globalThis.localStorage = {
  getItem: (k) => (k in memStore ? memStore[k] : null),
  setItem: (k, v) => { memStore[k] = String(v); },
  removeItem: (k) => { delete memStore[k]; },
};
globalThis.window = new EventTarget();

const auth = await import('../src/lib/auth.js');

const jsonResponse = (body, status = 200) => ({
  ok: status < 400,
  status,
  headers: { get: (h) => (h.toLowerCase() === 'content-type' ? 'application/json' : null) },
  json: async () => body,
});

const countCleared = () => {
  const spy = vi.fn();
  globalThis.window.addEventListener('auth:cleared', spy);
  return { spy, off: () => globalThis.window.removeEventListener('auth:cleared', spy) };
};

beforeEach(() => {
  memStore['naijataste.auth'] = JSON.stringify({ user: { id: 'u1' } });
  auth.setAuth({ user: { id: 'u1', email: 'a@b.co' }, accessToken: 'tok' });
});

describe('dropping the local session', () => {
  it('announces the change so the UI cannot stay signed in', () => {
    const { spy, off } = countCleared();

    auth.dropAuth();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(auth.getAuth()).toBeNull();
    expect(memStore['naijataste.auth']).toBeUndefined();
    off();
  });

  it('signs out locally even when the API is unreachable', async () => {
    const { spy, off } = countCleared();
    globalThis.fetch = vi.fn(async () => { throw new TypeError('Failed to fetch'); });

    await expect(auth.signout()).resolves.toBeUndefined();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(auth.getAuth()).toBeNull();
    off();
  });

  it('account deletion clears the session and announces it', async () => {
    const { spy, off } = countCleared();
    globalThis.fetch = vi.fn(async () => jsonResponse({ data: { ok: true } }));

    await auth.deleteAccount();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(auth.getAuth()).toBeNull();
    expect(memStore['naijataste.auth']).toBeUndefined();
    off();
  });
});
