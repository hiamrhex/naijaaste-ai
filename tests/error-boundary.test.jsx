// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ErrorBoundary, ErrorFallback } from '../src/components/ErrorBoundary.jsx';

// A render error used to unmount the whole tree: the router had 404/403 screens
// but no error element, and nothing wrapped the app, so production showed a
// blank white page with no way back.

const Boom = () => {
  throw new Error('kaboom');
};

afterEach(cleanup);

describe('ErrorBoundary', () => {
  it('renders a recoverable screen instead of a blank page', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /reload page/i })).toBeTruthy();

    spy.mockRestore();
  });

  it('passes children through when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>
    );

    expect(screen.getByText('All good')).toBeTruthy();
  });

  it('offers a way back into the app', () => {
    render(<ErrorFallback />);

    const link = screen.getByRole('link', { name: /back to naijataste/i });
    expect(link.getAttribute('href')).toBe('/app');
  });
});
