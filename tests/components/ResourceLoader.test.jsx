// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import { ResourceLoader } from '../../src/components/ResourceLoader.jsx';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ResourceLoader', () => {
  it('renders children immediately when it is not preloading', () => {
    render(
      React.createElement(ResourceLoader, null, React.createElement('p', null, 'content'))
    );

    expect(screen.getByText('content')).toBeTruthy();
    expect(screen.queryByText('Loading resources...')).toBeNull();
  });

  it('holds children back until a preload finishes', () => {
    vi.useFakeTimers();
    render(
      React.createElement(
        ResourceLoader,
        { preload: true },
        React.createElement('p', null, 'content')
      )
    );

    expect(screen.queryByText('content')).toBeNull();
    expect(screen.getByText('Loading resources...')).toBeTruthy();

    act(() => vi.advanceTimersByTime(1000));

    expect(screen.getByText('content')).toBeTruthy();
  });

  it('does not re-render forever once a key is cached', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      React.createElement(
        ResourceLoader,
        { preload: true, cacheKey: 'plans' },
        React.createElement('p', null, 'content')
      )
    );

    act(() => vi.advanceTimersByTime(1000));

    rerender(
      React.createElement(
        ResourceLoader,
        { preload: true, cacheKey: 'plans' },
        React.createElement('p', null, 'content')
      )
    );

    expect(screen.getByText('content')).toBeTruthy();
  });
});
