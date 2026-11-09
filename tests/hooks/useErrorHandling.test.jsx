// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { renderHook, act, cleanup, render, screen } from '@testing-library/react';
import { useRetry, ErrorBoundary } from '../../src/hooks/useErrorHandling.jsx';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useRetry', () => {
  it('stops after maxAttempts instead of recursing forever', async () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    const operation = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() =>
      useRetry({ maxAttempts: 2, initialDelay: 10, backoffFactor: 1, onRetry })
    );

    let outcome;
    await act(async () => {
      const pending = result.current.retry(operation).catch(error => error);
      await vi.runAllTimersAsync();
      outcome = await pending;
    });

    expect(outcome).toBeInstanceOf(Error);
    expect(outcome.message).toBe('Max retry attempts reached');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('returns the operation result when a later attempt succeeds', async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('flaky'))
      .mockResolvedValueOnce('ok');
    const { result } = renderHook(() =>
      useRetry({ maxAttempts: 3, initialDelay: 10, backoffFactor: 1 })
    );

    let outcome;
    await act(async () => {
      const pending = result.current.retry(operation);
      await vi.runAllTimersAsync();
      outcome = await pending;
    });

    expect(outcome).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(result.current.attempts).toBe(0);
  });

  it('uses the fallback once attempts are exhausted', async () => {
    vi.useFakeTimers();
    const operation = vi.fn().mockRejectedValue(new Error('down'));
    const fallback = vi.fn().mockResolvedValue('cached');
    const { result } = renderHook(() =>
      useRetry({ maxAttempts: 1, initialDelay: 10 })
    );

    let outcome;
    await act(async () => {
      const pending = result.current.retry(operation, fallback);
      await vi.runAllTimersAsync();
      outcome = await pending;
    });

    expect(outcome).toBe('cached');
    expect(operation).toHaveBeenCalledTimes(1);
  });
});

describe('ErrorBoundary', () => {
  it('renders the fallback when a child throws', () => {
    const Boom = () => {
      throw new Error('kaboom');
    };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      React.createElement(
        ErrorBoundary,
        { fallback: React.createElement('p', null, 'something broke') },
        React.createElement(Boom)
      )
    );

    expect(screen.getByText('something broke')).toBeTruthy();
    consoleError.mockRestore();
  });
});
