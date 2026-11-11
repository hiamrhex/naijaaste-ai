// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';
import { useAnalytics, useUserBehavior } from '../../src/hooks/useAnalytics.js';

const setViewport = (scrollHeight, clientHeight) => {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    value: clientHeight,
  });
};

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
  window.pageYOffset = 0;
  setViewport(2000, 1000);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useAnalytics', () => {
  it('tracks exactly one initial page view', async () => {
    const { result } = renderHook(() => useAnalytics());

    await waitFor(() => expect(result.current.pageViews).toBe(1));
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].eventName).toBe('page_view');
  });

  it('does not track or flush when tracking is disabled', async () => {
    const { result } = renderHook(() => useAnalytics({ enableTracking: false }));

    act(() => result.current.trackEvent('ignored'));
    await act(async () => {
      await result.current.flushEvents();
    });

    expect(result.current.events).toHaveLength(0);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('keeps events that arrive while a flush is in flight', async () => {
    let resolveFetch;
    globalThis.fetch = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = () => resolve({ ok: true });
        })
    );

    const { result } = renderHook(() => useAnalytics());
    await waitFor(() => expect(result.current.events).toHaveLength(1));

    let flushed;
    act(() => {
      flushed = result.current.flushEvents();
    });

    // A brand new event lands while the request is still open.
    act(() => result.current.trackEvent('during_flush'));

    await act(async () => {
      resolveFetch();
      await flushed;
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].eventName).toBe('during_flush');
  });

  it('auto-flushes once the queue grows past the limit', async () => {
    const { result } = renderHook(() => useAnalytics());
    await waitFor(() => expect(result.current.events).toHaveLength(1));

    await act(async () => {
      for (let i = 0; i < 60; i += 1) {
        result.current.trackEvent(`bulk_${i}`);
      }
    });

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.events.length).toBeGreaterThan(50);
  });
});

describe('useUserBehavior', () => {
  it('reports zero scroll percentage when the page cannot scroll', async () => {
    setViewport(1000, 1000);

    const { result } = renderHook(() => useUserBehavior());

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.scrolls).toHaveLength(1);
    expect(Number.isNaN(result.current.scrolls[0].scrollPercentage)).toBe(false);
    expect(result.current.scrolls[0].scrollPercentage).toBe(0);
  });

  it('caps recorded clicks so the buffer cannot grow without bound', () => {
    const { result } = renderHook(() => useUserBehavior());

    act(() => {
      for (let i = 0; i < 130; i += 1) {
        document.body.dispatchEvent(
          new MouseEvent('click', { clientX: i, clientY: i, bubbles: true })
        );
      }
    });

    expect(result.current.clicks.length).toBeLessThanOrEqual(100);
    // The most recent click must survive the trim.
    expect(result.current.clicks.at(-1).x).toBe(129);
  });
});
