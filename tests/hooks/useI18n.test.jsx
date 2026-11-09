// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';
import { useI18n } from '../../src/hooks/useI18n.jsx';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('dir');
  document.documentElement.removeAttribute('lang');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockFetch() {
  return vi.fn().mockImplementation(async url => {
    const code = String(url).match(/\/locales\/(\w+)\.json/)?.[1];
    return {
      ok: true,
      json: async () => ({ hello: `hello-${code}` }),
    };
  });
}

describe('useI18n', () => {
  it('does not refetch on every render when called with default options', async () => {
    const fetchMock = mockFetch();
    globalThis.fetch = fetchMock;

    const { rerender, result } = renderHook(() => useI18n());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const callsAfterMount = fetchMock.mock.calls.length;

    rerender();
    rerender();

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(fetchMock.mock.calls.length).toBe(callsAfterMount);
  });

  it('translates using the loaded messages', async () => {
    globalThis.fetch = mockFetch();

    const { result } = renderHook(() =>
      useI18n({ defaultLocale: 'en', messages: {} })
    );

    await waitFor(() => expect(result.current.t('hello')).toBe('hello-en'));
  });

  it('sets document direction from the new locale, not stale state', async () => {
    globalThis.fetch = mockFetch();

    const { result } = renderHook(() =>
      useI18n({ defaultLocale: 'en', supportedLocales: ['en', 'ar'] })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setLocale('ar');
    });

    expect(result.current.isRTL).toBe(true);
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('rejects unsupported locales without touching storage', async () => {
    globalThis.fetch = mockFetch();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useI18n({ supportedLocales: ['en'] }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setLocale('xx');
    });

    expect(warn).toHaveBeenCalled();
    expect(localStorage.getItem('locale')).toBeNull();
  });
});
