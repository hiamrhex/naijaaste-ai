import { useState, useEffect, useRef, useCallback, memo } from 'react';

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
  const lastElementRef = useCallback((node) => {
    if (loading) return;
    
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        loadMore();
      }
    }, {
      rootMargin,
      threshold,
    });
    
    if (node) observer.current.observe(node);
  }, [loading, hasMore, rootMargin, threshold]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const newData = await fetchCallback(page);
      setData(prev => [...prev, ...newData]);
      setHasMore(newData.length > 0);
      setPage(prev => prev + 1);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [fetchCallback, page, loading, hasMore]);

  const reset = useCallback(() => {
    setData([]);
    setPage(1);
    setHasMore(true);
    setError(null);
  }, []);

  // Initial load
  useEffect(() => {
    if (initialLoad) {
      loadMore();
    }
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
  const [lastScrollTop, setLastScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  
  const handleScroll = useCallback((event) => {
    const scrollTop = event.target.scrollTop;
    const windowHeight = event.target.clientHeight;
    const scrollHeight = event.target.scrollHeight;
    
    // Determine scroll direction
    if (scrollTop > lastScrollTop) {
      setScrollDirection('down');
    } else if (scrollTop < lastScrollTop) {
      setScrollDirection('up');
    }
    
    // Check if scrolling
    setIsScrolling(true);
    setLastScrollTop(scrollTop);
    
    // Check if at bottom
    const isAtBottom = scrollHeight - scrollTop <= windowHeight + 50;
    
    return {
      direction: scrollDirection,
      isAtBottom,
      scrollTop,
      scrollHeight,
      windowHeight,
    };
  }, [lastScrollTop, scrollDirection]);
  
  return { scrollDirection, isScrolling, handleScroll };
}

// Hook for scroll position tracking
export function useScrollPosition() {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  
  const handleScroll = useCallback(() => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const progress = (scrollTop / scrollHeight) * 100;
    
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