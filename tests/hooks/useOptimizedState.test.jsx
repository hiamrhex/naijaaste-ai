// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import {
  useOptimizedState,
  useBatchState,
  useMemoizedState,
  useOptimizedCounter,
} from '../../src/hooks/useOptimizedState.js';

let queue = [];
let originalRaf;
let originalCancel;

const flushFrame = (time) => {
  const callback = queue.shift();
  if (callback) callback(time);
  return queue.length;
};

beforeEach(() => {
  queue = [];
  originalRaf = globalThis.requestAnimationFrame;
  originalCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (cb) => {
    queue.push(cb);
    return queue.length;
  };
  globalThis.cancelAnimationFrame = vi.fn();
});

afterEach(() => {
  cleanup();
  globalThis.requestAnimationFrame = originalRaf;
  globalThis.cancelAnimationFrame = originalCancel;
  vi.restoreAllMocks();
});

describe('useOptimizedState', () => {
  it('updates immediately when no throttle is configured', () => {
    const onOptimizedUpdate = vi.fn();
    const { result } = renderHook(() =>
      useOptimizedState('a', { onOptimizedUpdate })
    );

    act(() => result.current.setValue('b'));

    expect(result.current.value).toBe('b');
    expect(onOptimizedUpdate).toHaveBeenCalledWith('b', 1);
  });

  it('applies the leading value and keeps one trailing update', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useOptimizedState('a', { throttleMs: 100 }));

    act(() => result.current.setValue('b'));
    expect(result.current.value).toBe('b');

    act(() => result.current.setValue('c'));
    expect(result.current.pendingValue).toBe('c');
    expect(result.current.value).toBe('b');

    act(() => vi.advanceTimersByTime(100));
    expect(result.current.value).toBe('c');
    expect(result.current.pendingValue).toBeNull();

    vi.useRealTimers();
  });

  it('immediateSetValue bypasses throttling and clears the pending value', () => {
    const { result } = renderHook(() => useOptimizedState('a', { throttleMs: 10_000 }));

    act(() => result.current.setValue('b'));
    act(() => result.current.setValue('pending'));
    expect(result.current.pendingValue).toBe('pending');

    act(() => result.current.immediateSetValue('forced'));

    expect(result.current.value).toBe('forced');
    expect(result.current.pendingValue).toBeNull();
  });

  it('debounces the pending value', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useOptimizedState('start', { debounceMs: 50 })
    );

    act(() => result.current.setValue('later'));
    expect(result.current.value).toBe('start');
    expect(result.current.pendingValue).toBe('later');

    act(() => vi.advanceTimersByTime(49));
    expect(result.current.value).toBe('start');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.value).toBe('later');

    vi.useRealTimers();
  });
});

describe('useBatchState', () => {
  it('applies queued updates together and resolves each promise', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useBatchState({ a: 0 }));

    const first = result.current.batch((state) => ({ ...state, a: state.a + 1 }));
    const second = result.current.batch((state) => ({ ...state, a: state.a + 10 }));

    await act(async () => {
      await vi.runAllTimersAsync();
      await Promise.all([first, second]);
    });

    expect(result.current.state.a).toBe(11);
    vi.useRealTimers();
  });
});

describe('useMemoizedState', () => {
  it('ignores values the comparator considers equal', () => {
    const { result } = renderHook(() =>
      useMemoizedState({ id: 1 }, (a, b) => a.id === b.id)
    );

    act(() => result.current[1]({ id: 1 }));
    expect(result.current[0]).toEqual({ id: 1 });

    act(() => result.current[1]({ id: 2 }));
    expect(result.current[0]).toEqual({ id: 2 });
  });
});

describe('useOptimizedCounter', () => {
  it('keeps requesting frames while it runs', () => {
    const { result } = renderHook(() =>
      useOptimizedCounter(0, { interval: 16, maxUpdates: 5 })
    );
    const base = performance.now();

    act(() => result.current.start());
    expect(result.current.isRunning).toBe(true);

    act(() => {
      flushFrame(base + 100);
    });
    expect(result.current.count).toBe(1);
    expect(queue).toHaveLength(1); // still running, next frame was scheduled

    act(() => {
      flushFrame(base + 200);
    });
    expect(result.current.count).toBe(2);
  });

  it('stops itself once maxUpdates is reached', () => {
    const onCountUpdate = vi.fn();
    const { result } = renderHook(() =>
      useOptimizedCounter(0, { interval: 16, maxUpdates: 2, onCountUpdate })
    );
    const base = performance.now();

    act(() => result.current.start());
    act(() => flushFrame(base + 100));
    act(() => flushFrame(base + 200));

    expect(result.current.count).toBe(2);
    expect(result.current.isRunning).toBe(false);
    expect(onCountUpdate).toHaveBeenLastCalledWith(2, 2);
    expect(queue).toHaveLength(0);
  });

  it('stop cancels the pending frame and reset restores the start value', () => {
    const { result } = renderHook(() =>
      useOptimizedCounter(7, { interval: 16, maxUpdates: 10 })
    );
    const base = performance.now();

    act(() => result.current.start());
    act(() => flushFrame(base + 100));
    act(() => result.current.stop());

    expect(result.current.isRunning).toBe(false);

    act(() => result.current.reset());

    expect(result.current.count).toBe(7);
    expect(result.current.isRunning).toBe(false);
  });

  it('start is idempotent while already running', () => {
    const { result } = renderHook(() =>
      useOptimizedCounter(0, { interval: 16, maxUpdates: 10 })
    );

    act(() => result.current.start());
    act(() => result.current.start());

    expect(queue).toHaveLength(1);
  });
});

