// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import {
  useDarkMode,
  useHighContrast,
  useFontSize,
  useThemeCustomization,
} from '../../src/hooks/useTheme.jsx';

function stubMatchMedia(matches) {
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  document.documentElement.removeAttribute('style');
  stubMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useDarkMode', () => {
  it('applies a stored preference on the first render', () => {
    localStorage.setItem('dark-mode', 'true');

    const { result } = renderHook(() => useDarkMode());

    expect(result.current.isDarkMode).toBe(true);
    expect(result.current.isInitialized).toBe(true);
  });

  it('follows the system preference when nothing is stored', () => {
    stubMatchMedia(true);

    const { result } = renderHook(() => useDarkMode());

    expect(result.current.isDarkMode).toBe(true);
    expect(result.current.isSystemDark).toBe(true);
  });

  it('persists an explicit toggle', () => {
    const { result } = renderHook(() => useDarkMode());

    act(() => result.current.toggleDarkMode());

    expect(result.current.isDarkMode).toBe(true);
    expect(localStorage.getItem('dark-mode')).toBe('true');
  });
});

describe('useHighContrast', () => {
  it('restores the stored value on the first render', () => {
    localStorage.setItem('high-contrast', 'true');

    const { result } = renderHook(() => useHighContrast());

    expect(result.current.isHighContrast).toBe(true);
  });
});

describe('useFontSize', () => {
  it('ignores stored sizes that are not in the allowed scale', () => {
    localStorage.setItem('font-size', 'gigantic');

    const { result } = renderHook(() => useFontSize());

    expect(result.current.fontSize).toBe('medium');
  });
});

describe('useThemeCustomization', () => {
  it('survives corrupt persisted JSON instead of throwing', () => {
    localStorage.setItem('theme-customization', '{not-json');

    const { result } = renderHook(() => useThemeCustomization());

    expect(result.current.theme).toBe('light');
    expect(result.current.customColors).toEqual({});
  });

  it('loads a stored theme and colors on the first render', () => {
    localStorage.setItem(
      'theme-customization',
      JSON.stringify({ theme: 'dark', customColors: { primary: '#000' } })
    );

    const { result } = renderHook(() =>
      useThemeCustomization({ defaultColors: { primary: '#fff' } })
    );

    expect(result.current.theme).toBe('dark');
    expect(result.current.customColors).toEqual({ primary: '#000' });
  });
});
