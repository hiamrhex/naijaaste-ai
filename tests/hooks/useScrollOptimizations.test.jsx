// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';
import {
  useInfiniteScroll,
  useScrollDirection,
  useScrollPosition,
} from '../../src/hooks/useScrollOptimizations.js';

let observers;

class FakeIntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.observed = [];
    observers.push(this);
  }
  observe(node) { this.observed.push(node); }
  disconnect() { this.observed = []; }
}

beforeEach(() => {
  observers = [];
  globalThis.IntersectionObserver = FakeIntersectionObserver;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useInfiniteScroll', () => {
  it('loads the first page exactly once on mount', async () => {
    const fetchCallback = vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const { result } = renderHook(() =>
      useInfiniteScroll({ fetchCallback })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Give any runaway effect a chance to fire again.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fetchCallback).toHaveBeenCalledTimes(1);
    expect(fetchCallback).toHaveBeenCalledWith(1);
    expect(result.current.data).toHaveLength(2);
  });

  it('does not construct an out-of-range IntersectionObserver threshold', () => {
    const fetchCallback = vi.fn().mockResolvedValue([]);

    const { result } = renderHook(() =>
      useInfiniteScroll({ fetchCallback, options: { initialLoad: false } })
    );

    act(() => result.current.lastElementRef(document.createElement('div')));

    expect(observers).toHaveLength(1);
    expect(observers[0].options.threshold).toBeGreaterThanOrEqual(0);
    expect(observers[0].options.threshold).toBeLessThanOrEqual(1);
    expect(observers[0].options.rootMargin).toBe('200px');
  });

  it('stops paginating when a page comes back empty', async () => {
    const fetchCallback = vi
      .fn()
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([]);

    const { result } = renderHook(() =>
      useInfiniteScroll({ fetchCallback })
    );

    await waitFor(() => expect(result.current.hasMore).toBe(true));
    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.hasMore).toBe(false);
    expect(result.current.data).toHaveLength(1);
  });

  it('reset clears data, page and error state', async () => {
    const fetchCallback = vi.fn().mockResolvedValue([{ id: 1 }]);

    const { result } = renderHook(() => useInfiniteScroll({ fetchCallback }));
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    act(() => result.current.reset());

    expect(result.current.data).toEqual([]);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.error).toBeNull();
  });
});

describe('useScrollDirection', () => {
  const scrollEvent = (scrollTop) => ({
    target: { scrollTop, clientHeight: 500, scrollHeight: 1000 },
  });

  it('reports the direction of the scroll it just handled', () => {
    const { result } = renderHook(() => useScrollDirection());

    let first;
    act(() => {
      first = result.current.handleScroll(scrollEvent(50));
    });
    expect(first.direction).toBe('down');

    let second;
    act(() => {
      second = result.current.handleScroll(scrollEvent(10));
    });
    expect(second.direction).toBe('up');
    expect(result.current.scrollDirection).toBe('up');
  });

  it('detects when the container is near the bottom', () => {
    const { result } = renderHook(() => useScrollDirection());

    let nearBottom;
    act(() => {
      nearBottom = result.current.handleScroll(scrollEvent(480));
    });
    expect(nearBottom.isAtBottom).toBe(true);

    let nearTop;
    act(() => {
      nearTop = result.current.handleScroll(scrollEvent(10));
    });
    expect(nearTop.isAtBottom).toBe(false);
  });
});

describe('useScrollPosition', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'pageYOffset', {
      configurable: true,
      writable: true,
      value: 0,
    });
  });

  it('reports zero progress on a page that cannot scroll', () => {
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 0,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      value: 0,
    });

    const { result } = renderHook(() => useScrollPosition());

    act(() => window.dispatchEvent(new Event('scroll')));

    expect(Number.isNaN(result.current.scrollProgress)).toBe(false);
    expect(result.current.scrollProgress).toBe(0);
  });

  it('computes progress as a bounded percentage', () => {
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      value: 1000,
    });
    window.pageYOffset = 500;

    const { result } = renderHook(() => useScrollPosition());

    act(() => window.dispatchEvent(new Event('scroll')));

    expect(result.current.scrollPosition).toBe(500);
    expect(result.current.scrollProgress).toBe(50);
  });
});
