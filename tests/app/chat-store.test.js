// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const STORAGE_KEY = 'nt.chat.v1';
const WELCOME = "Welcome! I'm NaijaTaste AI — your personal guide to the best restaurants across Nigeria. Tell me about yourself — your city, your budget, what you're craving — and I'll find the perfect spot for you.";

const loadStore = async () => {
  vi.resetModules();
  return (await import('../../src/app/chat-store.js')).chatStore;
};

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe('chatStore hydration', () => {
  it('starts a fresh conversation with the welcome message', async () => {
    const store = await loadStore();

    expect(store.get().messages).toEqual([{ role: 'assistant', content: WELCOME }]);
    expect(store.get().stage).toBe('gather');
  });

  it('falls back to the welcome message when the stored JSON is corrupt', async () => {
    localStorage.setItem(STORAGE_KEY, '{oops');
    const store = await loadStore();

    expect(store.get().messages).toEqual([{ role: 'assistant', content: WELCOME }]);
  });

  it('falls back when the stored value is not an object', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['not', 'a', 'chat']));
    const store = await loadStore();

    expect(store.get().messages).toEqual([{ role: 'assistant', content: WELCOME }]);
  });

  it('never restores a conversation with no usable messages', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ messages: [null, { role: 'user' }, { role: 'assistant' }] })
    );
    const store = await loadStore();

    // Filtering the junk out used to leave an empty array, i.e. a blank chat
    // with no greeting and no way to start.
    expect(store.get().messages).toEqual([{ role: 'assistant', content: WELCOME }]);
  });

  it('keeps the valid messages and drops the junk', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        messages: [
          { role: 'assistant', content: 'hello' },
          null,
          { role: 'user' },
          { role: 'user', content: 'jollof please' },
        ],
        stage: 'recommend',
        showQuickPrompts: false,
      })
    );
    const store = await loadStore();

    expect(store.get().messages).toEqual([
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'jollof please' },
    ]);
    expect(store.get().stage).toBe('recommend');
    expect(store.get().showQuickPrompts).toBe(false);
  });
});

describe('chatStore updates', () => {
  it('notifies subscribers and persists every change', async () => {
    const store = await loadStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set((prev) => ({ messages: [...prev.messages, { role: 'user', content: 'hi' }] }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).messages).toHaveLength(2);

    unsubscribe();
    store.set({ stage: 'results' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reset starts a new conversation and clears the session', async () => {
    const store = await loadStore();
    store.set({ sessionId: 's1', stage: 'results' });

    store.reset();

    expect(store.get().sessionId).toBeNull();
    expect(store.get().stage).toBe('gather');
    expect(store.get().messages).toEqual([{ role: 'assistant', content: WELCOME }]);
  });

  it('clear returns the store to its default state', async () => {
    const store = await loadStore();
    store.set({ messages: [{ role: 'user', content: 'hi' }], stage: 'results' });

    store.clear();

    expect(store.get().messages).toEqual([{ role: 'assistant', content: WELCOME }]);
    expect(store.get().stage).toBe('gather');
  });
});
