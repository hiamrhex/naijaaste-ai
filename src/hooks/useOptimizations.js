import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// Custom hook for debouncing expensive operations
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Custom hook for throttling function calls
export function useThrottle(callback, delay) {
  const lastCallRef = useRef(0);

  return useCallback((...args) => {
    const now = Date.now();
    if (now - lastCallRef.current >= delay) {
      lastCallRef.current = now;
      callback(...args);
    }
  }, [callback, delay]);
}

// Custom hook for optimizing list rendering with virtualization
export function useVirtualization(items, itemHeight = 60, containerHeight = 400) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );

  const visibleItems = useMemo(() => 
    items.slice(startIndex, endIndex), 
    [items, startIndex, endIndex]
  );

  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  return {
    visibleItems,
    totalHeight,
    offsetY,
    setScrollTop,
    startIndex,
    endIndex,
  };
}

// Custom hook for optimizing image loading
export function useImageLoading(src, placeholder = null) {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // An empty source used to be assigned to `img.src`, which makes the
    // browser fetch the current page as if it were an image.
    if (!src) {
      setImageSrc(placeholder);
      setIsLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    const img = new globalThis.Image();

    // Drop the previous picture while the next one downloads so the UI does
    // not show the wrong dish.
    setImageSrc(placeholder);
    setIsLoading(true);
    setError(null);

    img.onload = () => {
      if (cancelled) return;
      setImageSrc(src);
      setIsLoading(false);
    };

    img.onerror = () => {
      if (cancelled) return;
      setError('Failed to load image');
      setIsLoading(false);
    };

    img.src = src;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [src, placeholder]);

  return { imageSrc, isLoading, error };
}

// Custom hook for optimizing API calls
export function useAPICall(apiFunction, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Default to an empty array: spreading `undefined` in the dependency list
  // below throws before the hook can run.
  const dependencies = options.dependencies || [];

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiFunction(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFunction, ...dependencies]);

  return { data, loading, error, execute };
}