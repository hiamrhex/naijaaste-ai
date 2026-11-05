// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, renderHook, act, cleanup } from '@testing-library/react';
import {
  PerformanceMetrics,
  usePerformanceMonitor,
  useMemoizationTracker,
} from '../../src/hooks/usePerformanceMonitor.jsx';

afterEach(() => cleanup());

describe('PerformanceMetrics', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(
      <PerformanceMetrics
        metrics={{ renderTime: 0, memoizationHits: 0, memoizationMisses: 0 }}
        isVisible={false}
      />
    );
    expect(container.innerHTML).toBe('');
    expect(screen.queryByText('Performance Metrics')).toBeNull();
  });

  it('renders every metric when visible', () => {
    const metrics = { renderTime: 100, memoizationHits: 5, memoizationMisses: 2 };
    render(<PerformanceMetrics metrics={metrics} isVisible />);

    expect(screen.getByText('Performance Metrics')).toBeTruthy();
    expect(screen.getByText('Render Time: 100.00ms')).toBeTruthy();
    expect(screen.getByText('Memoization Hits: 5')).toBeTruthy();
    expect(screen.getByText('Memoization Misses: 2')).toBeTruthy();
  });
});

describe('usePerformanceMonitor', () => {
  it('initialises with zeroed metrics', () => {
    const { result } = renderHook(() => usePerformanceMonitor());
    expect(result.current).toEqual({
      renderTime: 0,
      memoizationHits: 0,
      memoizationMisses: 0,
    });
  });
});

describe('useMemoizationTracker', () => {
  it('counts hits, misses and active memoizations', () => {
    const { result } = renderHook(() => useMemoizationTracker());

    expect(result.current.hits).toBe(0);
    expect(result.current.misses).toBe(0);
    expect(result.current.activeMemoizations).toBe(0);

    act(() => {
      result.current.incrementHits();
      result.current.incrementMisses();
      result.current.setActiveMemoizations(3);
    });

    expect(result.current.hits).toBe(1);
    expect(result.current.misses).toBe(1);
    expect(result.current.activeMemoizations).toBe(3);
  });
});

// Guard against the render path silently throwing (it used to import `vi`
// without declaring it, so this file failed at collection instead of test).
describe('render smoke', () => {
  it('does not throw while rendering a metric panel', () => {
    const spy = vi.fn();
    expect(() =>
      render(<PerformanceMetrics metrics={{ renderTime: 1, memoizationHits: 1, memoizationMisses: 1 }} isVisible />)
    ).not.toThrow();
    spy();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
