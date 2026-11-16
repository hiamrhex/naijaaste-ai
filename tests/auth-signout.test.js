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

  it('purges the previous account\'s activity from this device', async () => {
    // A second account signing in on the same device used to open the first
    // account's chat, persona, history, plans and check-in prompts.
    for (const k of [
      'nt.chat.v1', 'nt.history.v1', 'nt.plans.v1',
      'nt.checkin.queue.v1', 'nt.checkin.answered.v1', 'nt.checkin.dismissed.v1',
    ]) {
      memStore[k] = JSON.stringify({ previous: 'account' });
    }

    auth.dropAuth();

    for (const k of [
      'nt.chat.v1', 'nt.history.v1', 'nt.plans.v1',
      'nt.checkin.queue.v1', 'nt.checkin.answered.v1', 'nt.checkin.dismissed.v1',
    ]) {
      expect(memStore[k]).toBeUndefined();
    }
  });

  it('resets the in-memory chat so the next account does not see it', async () => {
    const { chatStore } = await import('../src/app/chat-store.js');
    chatStore.set({ sessionId: 'session-of-user-a', persona: { full_name: 'User A' } });

    auth.dropAuth();

    expect(chatStore.get().sessionId).toBeNull();
    expect(chatStore.get().persona).toBeNull();
  });
});
