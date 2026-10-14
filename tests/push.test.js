import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadPush, allowPush, denyPush, setPushMuted,
  shouldPromptPush, isPushKindAllowed, PUSH_KEY,
} from '../src/lib/push.js';

const storage = {};
globalThis.localStorage = {
  getItem: (k) => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
};

beforeEach(() => {
  delete storage[PUSH_KEY];
});

describe('push opt-in logic (plan K)', () => {
  it('defaults to unasked + unmuted', () => {
    expect(loadPush()).toMatchObject({ status: 'unasked', muted: false });
  });

  it('never prompts on first load or without a good moment', () => {
    expect(shouldPromptPush({ goodMoment: false, visits: 5 })).toBe(false);
    expect(shouldPromptPush({ goodMoment: true, visits: 1 })).toBe(false);
    expect(shouldPromptPush({ goodMoment: true, visits: 0 })).toBe(false);
  });

  it('prompts after a good moment on a return visit', () => {
    expect(shouldPromptPush({ goodMoment: true, visits: 2 })).toBe(true);
  });

  it('never re-prompts after allow, deny, or mute', () => {
    allowPush();
    expect(shouldPromptPush({ goodMoment: true, visits: 9 })).toBe(false);
    delete storage[PUSH_KEY];
    denyPush();
    expect(shouldPromptPush({ goodMoment: true, visits: 9 })).toBe(false);
    delete storage[PUSH_KEY];
    setPushMuted(true);
    expect(shouldPromptPush({ goodMoment: true, visits: 9 })).toBe(false);
  });

  it('respects browser-level denial', () => {
    expect(shouldPromptPush({ goodMoment: true, visits: 5, permission: 'denied' })).toBe(false);
  });

  it('only Thursday + check-in kinds are sendable', () => {
    expect(isPushKindAllowed('thursday-suggestion')).toBe(true);
    expect(isPushKindAllowed('rating-check-in')).toBe(true);
    expect(isPushKindAllowed('promo')).toBe(false);
    expect(isPushKindAllowed('')).toBe(false);
  });

  it('mute toggles without losing the decision', () => {
    allowPush();
    setPushMuted(true);
    expect(loadPush()).toMatchObject({ status: 'allowed', muted: true });
    setPushMuted(false);
    expect(loadPush()).toMatchObject({ status: 'allowed', muted: false });
  });
});
