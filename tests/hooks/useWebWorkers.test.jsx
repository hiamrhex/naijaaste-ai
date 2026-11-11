// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';
import { useWebWorker, useWorkerPool } from '../../src/hooks/useWebWorkers.js';

let workers;

class FakeWorker {
  constructor(url) {
    this.url = url;
    this.posted = [];
    this.listeners = {};
    this.terminated = false;
    workers.push(this);
  }
  addEventListener(type, fn) {
    (this.listeners[type] = this.listeners[type] || []).push(fn);
  }
  removeEventListener(type, fn) {
    this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn);
  }
  postMessage(message) {
    this.posted.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  emit(type, event) {
    (this.listeners[type] || []).forEach((fn) => fn(event));
  }
}

beforeEach(() => {
  workers = [];
  globalThis.Worker = FakeWorker;
  URL.createObjectURL = vi.fn(() => 'blob:worker');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useWebWorker', () => {
  it('survives unmount after terminate', () => {
    const { result, unmount } = renderHook(() => useWebWorker('self.onmessage = () => {}'));

    expect(() => {
      act(() => result.current.terminate());
      unmount();
    }).not.toThrow();

    expect(workers[0].terminated).toBe(true);
  });

  it('does not rebuild the worker when callbacks are inline', () => {
    const { rerender } = renderHook(
      ({ value }) =>
        useWebWorker('self.onmessage = () => {}', {
          onMessage: () => value,
        }),
      { initialProps: { value: 1 } }
    );

    rerender({ value: 2 });
    rerender({ value: 3 });

    expect(workers).toHaveLength(1);
  });

  it('delivers messages to the latest callback', () => {
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = renderHook(
      ({ handler }) => useWebWorker('self.onmessage = () => {}', { onMessage: handler }),
      { initialProps: { handler: first } }
    );

    rerender({ handler: second });
    act(() => workers[0].onmessage({ data: { result: 42 } }));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({ result: 42 });
  });

  it('revokes the blob URL on unmount', () => {
    const { unmount } = renderHook(() => useWebWorker('self.onmessage = () => {}'));
    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:worker');
  });
});

describe('useWorkerPool', () => {
  it('hands concurrent jobs to different workers', async () => {
    const { result } = renderHook(() => useWorkerPool('self.onmessage = () => {}', 2));
    await waitFor(() => expect(result.current.isReady).toBe(true));

    let first;
    let second;
    act(() => {
      first = result.current.execute('a');
      second = result.current.execute('b');
    });

    expect(workers[0].posted).toEqual(['a']);
    expect(workers[1].posted).toEqual(['b']);

    act(() => {
      workers[0].emit('message', { data: 'ra' });
      workers[1].emit('message', { data: 'rb' });
    });

    await expect(first).resolves.toBe('ra');
    await expect(second).resolves.toBe('rb');
  });

  it('rejects when every worker is busy', async () => {
    const { result } = renderHook(() => useWorkerPool('self.onmessage = () => {}', 1));
    await waitFor(() => expect(result.current.isReady).toBe(true));

    let first;
    act(() => {
      first = result.current.execute('a');
    });

    await expect(result.current.execute('b')).rejects.toThrow('No available workers');

    act(() => workers[0].emit('message', { data: 'done' }));
    await expect(first).resolves.toBe('done');
  });

  it('reports zero utilisation instead of NaN for an empty pool', async () => {
    const { result } = renderHook(() => useWorkerPool('self.onmessage = () => {}', 0));
    await waitFor(() => expect(result.current.isReady).toBe(true));

    const stats = result.current.getStats();
    expect(stats.utilization).toBe(0);
    expect(Number.isNaN(stats.utilization)).toBe(false);
  });

  it('terminates and revokes every worker on unmount', async () => {
    const { result, unmount } = renderHook(() =>
      useWorkerPool('self.onmessage = () => {}', 2)
    );
    await waitFor(() => expect(result.current.isReady).toBe(true));

    unmount();

    expect(workers.every((worker) => worker.terminated)).toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
});
