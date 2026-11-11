// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useAccessibility } from '../../src/hooks/useAccessibility.jsx';

const setMatchMedia = (impl) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: impl,
  });
};

beforeEach(() => {
  setMatchMedia(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.querySelectorAll('[aria-live]').forEach((node) => node.remove());
});

describe('useAccessibility reduced motion', () => {
  it('still renders when matchMedia is unavailable', () => {
    setMatchMedia(undefined);

    const { result } = renderHook(() => useAccessibility());

    expect(result.current.reducedMotion).toBe(false);
    expect(result.current.isKeyboardUser).toBe(false);
  });

  it('reads the initial preference when matchMedia exists', () => {
    setMatchMedia(vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));

    const { result } = renderHook(() => useAccessibility());

    expect(result.current.reducedMotion).toBe(true);
  });

  it('subscribes with addEventListener when available', () => {
    const listeners = {};
    setMatchMedia(() => ({
      matches: false,
      addEventListener: (type, fn) => { listeners[type] = fn; },
      removeEventListener: vi.fn(),
    }));

    const { result } = renderHook(() => useAccessibility());

    act(() => listeners.change({ matches: true }));
    expect(result.current.reducedMotion).toBe(true);
  });

  it('falls back to the legacy addListener API', () => {
    const listeners = {};
    setMatchMedia(() => ({
      matches: false,
      addListener: (fn) => { listeners.change = fn; },
      removeListener: vi.fn(),
    }));

    const { result } = renderHook(() => useAccessibility());

    act(() => listeners.change({ matches: true }));
    expect(result.current.reducedMotion).toBe(true);
  });
});

describe('useAccessibility announcements', () => {
  it('announces politely through a live region', () => {
    const { result } = renderHook(() => useAccessibility());

    act(() => result.current.announceToScreenReader('Saved!'));

    const region = document.querySelector('[aria-live="polite"]');
    expect(region).not.toBeNull();
    expect(region.textContent).toBe('Saved!');
  });

  it('removes its live regions on unmount', () => {
    const { result, unmount } = renderHook(() => useAccessibility());

    act(() => result.current.announceToScreenReader('Saved!'));
    expect(document.querySelector('[aria-live="polite"]')).not.toBeNull();

    unmount();

    expect(document.querySelector('[aria-live="polite"]')).toBeNull();
  });
});
