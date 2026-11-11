// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';
import { useInstallPrompt } from '../../src/hooks/useInstallPrompt.js';

const BEFORE = 'beforeinstallprompt';
const MOMENT = 'nt:good-moment';
const DISMISS_KEY = 'nt.install.dismissed.v1';

const promptEvent = (outcome) => {
  const event = new Event(BEFORE);
  event.preventDefault = vi.fn();
  event.prompt = vi.fn();
  event.userChoice = Promise.resolve({ outcome });
  return event;
};

beforeEach(() => {
  localStorage.clear();
  globalThis.matchMedia = vi.fn(() => ({ matches: false }));
  Object.defineProperty(navigator, 'standalone', { configurable: true, value: false });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('useInstallPrompt', () => {
  it('stays hidden until a good moment happens', () => {
    const { result } = renderHook(() => useInstallPrompt());

    act(() => globalThis.dispatchEvent(promptEvent('accepted')));

    expect(result.current.visible).toBe(false);
  });

  it('shows the sheet once a prompt is available and a good moment occurs', () => {
    const { result } = renderHook(() => useInstallPrompt());

    act(() => globalThis.dispatchEvent(new Event(MOMENT)));
    act(() => globalThis.dispatchEvent(promptEvent('accepted')));

    expect(result.current.visible).toBe(true);
    expect(result.current.installed).toBe(false);
  });

  it('does not claim the app is installed when the user declines', async () => {
    const { result } = renderHook(() => useInstallPrompt());

    act(() => globalThis.dispatchEvent(new Event(MOMENT)));
    act(() => globalThis.dispatchEvent(promptEvent('dismissed')));
    await waitFor(() => expect(result.current.visible).toBe(true));

    let installed;
    await act(async () => {
      installed = await result.current.install();
    });

    expect(installed).toBe(false);
    expect(result.current.installed).toBe(false);
    expect(result.current.visible).toBe(false);
    // Declining snoozes the sheet rather than disabling install forever.
    expect(localStorage.getItem(DISMISS_KEY)).toBeTruthy();
  });

  it('marks the app installed only when the user accepts', async () => {
    const { result } = renderHook(() => useInstallPrompt());

    act(() => globalThis.dispatchEvent(new Event(MOMENT)));
    act(() => globalThis.dispatchEvent(promptEvent('accepted')));
    await waitFor(() => expect(result.current.visible).toBe(true));

    let installed;
    await act(async () => {
      installed = await result.current.install();
    });

    expect(installed).toBe(true);
    expect(result.current.installed).toBe(true);
    expect(result.current.visible).toBe(false);
  });

  it('is a no-op when there is no captured prompt', async () => {
    const { result } = renderHook(() => useInstallPrompt());

    let installed;
    await act(async () => {
      installed = await result.current.install();
    });

    expect(installed).toBe(false);
    expect(result.current.installed).toBe(false);
  });

  it('never shows the sheet when already running standalone', () => {
    globalThis.matchMedia = vi.fn(() => ({ matches: true }));
    const { result } = renderHook(() => useInstallPrompt());

    act(() => globalThis.dispatchEvent(new Event(MOMENT)));
    act(() => globalThis.dispatchEvent(promptEvent('accepted')));

    expect(result.current.installed).toBe(true);
    expect(result.current.visible).toBe(false);
  });

  it('remembers a dismissal for the next mount', () => {
    const first = renderHook(() => useInstallPrompt());
    act(() => first.result.current.dismiss());
    expect(first.result.current.visible).toBe(false);
    first.unmount();

    const second = renderHook(() => useInstallPrompt());
    act(() => globalThis.dispatchEvent(new Event(MOMENT)));
    act(() => globalThis.dispatchEvent(promptEvent('accepted')));

    expect(second.result.current.visible).toBe(false);
  });
});
