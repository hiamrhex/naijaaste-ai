import { useState, useEffect, useRef, useCallback } from 'react';

// Infinite scroll hook for loading data as the user scrolls
export function useInfiniteScroll({
  fetchCallback,
  options = {}
}) {
  const {
    threshold = 200,
    rootMargin = '200px',
    initialLoad = true,
  } = options;

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  
  const observer = useRef();
  const loadingRef = useRef(false);
  const initialLoadDone = useRef(false);

  // `threshold` is the pixel distance the caller wants to preload (it is
  // paired with rootMargin). IntersectionObserver only accepts a 0–1 ratio,
  // and passing 200 throws before the observer is ever created.
  const observerThreshold = threshold > 0 && threshold <= 1 ? threshold : 0;

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);
    
    try {
      const newData = await fetchCallback(page);
      const rows = Array.isArray(newData) ? newData : [];
      setData(prev => [...prev, ...rows]);
      setHasMore(rows.length > 0);
      setPage(prev => prev + 1);
    } catch (err) {
      setError(err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [fetchCallback, page, hasMore]);

  const lastElementRef = useCallback((node) => {
    if (loading) return;
    
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
        loadMore();
      }
    }, {
      rootMargin,
      threshold: observerThreshold,
    });
    
    if (node) observer.current.observe(node);
  }, [loading, hasMore, rootMargin, observerThreshold, loadMore]);

  const reset = useCallback(() => {
    setData([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    initialLoadDone.current = false;
  }, []);

  // Initial load: exactly once. Depending on `loadMore` re-ran the effect
  // every time `page` changed, so mount auto-paginated the whole dataset
  // (235 requests before the guard was added).
  useEffect(() => {
    if (!initialLoad || initialLoadDone.current) return;
    initialLoadDone.current = true;
    loadMore();
  }, [initialLoad, loadMore]);

  return {
    data,
    loading,
    error,
    hasMore,
    lastElementRef,
    loadMore,
    reset,
  };
}

// Hook for debouncing scroll events
export function useDebouncedScroll(callback, delay = 100) {
  const timeoutRef = useRef();
  
  return useCallback((event) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(event);
    }, delay);
  }, [callback, delay]);
}

// Hook for throttled scroll events
export function useThrottledScroll(callback, delay = 100) {
  const lastCallRef = useRef(0);
  
  return useCallback((event) => {
    const now = Date.now();
    if (now - lastCallRef.current >= delay) {
      lastCallRef.current = now;
      callback(event);
    }
  }, [callback, delay]);
}

// Hook for detecting scroll direction
export function useScrollDirection() {
  const [scrollDirection, setScrollDirection] = useState('down');
  const [isScrolling, setIsScrolling] = useState(false);
  const lastScrollTopRef = useRef(0);
  const directionRef = useRef('down');

  const handleScroll = useCallback((event) => {
    const target = event?.target ?? {};
    const scrollTop = Number(target.scrollTop) || 0;
    const windowHeight = Number(target.clientHeight) || 0;
    const scrollHeight = Number(target.scrollHeight) || 0;

    // Work out the direction from the event being handled right now. Reading
    // it from state returned the direction of the *previous* event, so callers
    // were always one scroll behind.
    const previous = lastScrollTopRef.current;
    let direction = directionRef.current;
    if (scrollTop > previous) {
      direction = 'down';
    } else if (scrollTop < previous) {
      direction = 'up';
    }

    lastScrollTopRef.current = scrollTop;
    directionRef.current = direction;
    setIsScrolling(true);
    setScrollDirection(direction);

    // Check if at bottom
    const isAtBottom = scrollHeight - scrollTop <= windowHeight + 50;

    return {
      direction,
      isAtBottom,
      scrollTop,
      scrollHeight,
      windowHeight,
    };
  }, []);

  return { scrollDirection, isScrolling, handleScroll };
}

// Hook for scroll position tracking
export function useScrollPosition() {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  
  const handleScroll = useCallback(() => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
    const scrollable =
      document.documentElement.scrollHeight - document.documentElement.clientHeight;

    // A page that fits inside the viewport cannot scroll. Dividing by zero
    // produced NaN, which then propagated into every consumer of
    // scrollProgress.
    const progress =
      scrollable > 0
        ? Math.min(100, Math.max(0, (scrollTop / scrollable) * 100))
        : 0;

    setScrollPosition(scrollTop);
    setScrollProgress(progress);
  }, []);
  
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);
  
  return { scrollPosition, scrollProgress };
}

// Hook for sticky scroll behavior
export function useStickyScroll(threshold = 100) {
  const [isSticky, setIsSticky] = useState(false);
  const [stickyOffset, setStickyOffset] = useState(0);
  
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const element = document.querySelector('.sticky-element');
      
      if (element) {
        const rect = element.getBoundingClientRect();
        const offset = rect.top + window.pageYOffset;
        
        setIsSticky(scrollTop > threshold);
        setStickyOffset(Math.max(0, scrollTop - offset));
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);
  
  return { isSticky, stickyOffset };
}