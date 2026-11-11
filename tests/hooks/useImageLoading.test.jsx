// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useImageLoading } from '../../src/hooks/useOptimizations.js';

let images;

class FakeImage {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this._src = null;
    images.push(this);
  }
  set src(value) { this._src = value; }
  get src() { return this._src; }
}

beforeEach(() => {
  images = [];
  globalThis.Image = FakeImage;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useImageLoading', () => {
  it('does not request anything for an empty source', () => {
    const { result } = renderHook(() => useImageLoading(''));

    expect(images).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.imageSrc).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('swaps in the source once the browser loads it', () => {
    const { result } = renderHook(() => useImageLoading('dish.png'));

    expect(images).toHaveLength(1);
    expect(images[0].src).toBe('dish.png');
    expect(result.current.isLoading).toBe(true);
    expect(result.current.imageSrc).toBeNull();

    act(() => images[0].onload());

    expect(result.current.imageSrc).toBe('dish.png');
    expect(result.current.isLoading).toBe(false);
  });

  it('reports a load failure instead of leaving the spinner up', () => {
    const { result } = renderHook(() => useImageLoading('missing.png'));

    act(() => images[0].onerror());

    expect(result.current.error).toBe('Failed to load image');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.imageSrc).toBeNull();
  });

  it('drops the previous image while a new source loads', () => {
    const { result, rerender } = renderHook(
      ({ src }) => useImageLoading(src),
      { initialProps: { src: 'old.png' } }
    );

    act(() => images[0].onload());
    expect(result.current.imageSrc).toBe('old.png');

    rerender({ src: 'new.png' });

    // Showing the old dish while the new one downloads is misleading.
    expect(result.current.imageSrc).toBeNull();
    expect(result.current.isLoading).toBe(true);

    act(() => images[1].onload());
    expect(result.current.imageSrc).toBe('new.png');
  });

  it('ignores a load that resolves after unmount', () => {
    const { unmount } = renderHook(() => useImageLoading('slow.png'));
    const img = images[0];

    unmount();
    expect(img.onload).toBeNull();
    expect(img.onerror).toBeNull();
  });
});
