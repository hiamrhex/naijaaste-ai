// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import {
  useDebounce,
  useThrottle,
  useVirtualization,
  useAPICall,
} from '../../src/hooks/useOptimizations.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useDebounce', () => {
  beforeEach(() => vi.useFakeTimers());

  it('only publishes the latest value after the delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 300 } }
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'updated', delay: 300 });
    expect(result.current).toBe('initial');

    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe('initial');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('updated');
  });

  it('cancels the pending update when the value changes again', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } }
    );

    rerender({ value: 'b' });
    act(() => vi.advanceTimersByTime(150));
    rerender({ value: 'c' });
    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('c');
  });
});

describe('useThrottle', () => {
  it('drops calls inside the window and admits the next one after it', () => {
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    const fn = vi.fn();
    const { result } = renderHook(() => useThrottle(fn, 200));

    act(() => result.current('first'));
    expect(fn).toHaveBeenCalledTimes(1);

    now = 1100;
    act(() => result.current('second'));
    expect(fn).toHaveBeenCalledTimes(1);

    now = 1201;
    act(() => result.current('third'));
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('third');
  });
});

describe('useVirtualization', () => {
  it('returns a window sized to the container and offsets it', () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const { result } = renderHook(() => useVirtualization(items, 50, 200));

    expect(result.current.totalHeight).toBe(5000);
    expect(result.current.startIndex).toBe(0);
    expect(result.current.visibleItems).toEqual(items.slice(0, 5));

    act(() => result.current.setScrollTop(500));
    expect(result.current.startIndex).toBe(10);
    expect(result.current.offsetY).toBe(500);
    expect(result.current.visibleItems).toEqual(items.slice(10, 15));
  });

  it('never slices past the end of the list', () => {
    const items = [1, 2, 3];
    const { result } = renderHook(() => useVirtualization(items, 50, 200));
    act(() => result.current.setScrollTop(10_000));
    expect(result.current.endIndex).toBe(items.length);
    expect(result.current.visibleItems).toEqual([]);
  });
});

describe('useAPICall', () => {
  it('exposes data and clears loading on success', async () => {
    const api = vi.fn(async (x) => ({ doubled: x * 2 }));
    const { result } = renderHook(() => useAPICall(api));

    let returned;
    await act(async () => {
      returned = await result.current.execute(21);
    });

    expect(returned).toEqual({ doubled: 42 });
    expect(result.current.data).toEqual({ doubled: 42 });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('captures the error and rethrows', async () => {
    const boom = new Error('nope');
    const api = vi.fn(async () => { throw boom; });
    const { result } = renderHook(() => useAPICall(api));

    await act(async () => {
      await expect(result.current.execute()).rejects.toBe(boom);
    });

    expect(result.current.error).toBe(boom);
    expect(result.current.loading).toBe(false);
  });

  it('works without an options object (the spread used to throw)', async () => {
    const api = vi.fn(async () => 'ok');
    const { result } = renderHook(() => useAPICall(api));

    await act(async () => {
      expect(await result.current.execute()).toBe('ok');
    });
  });
});
