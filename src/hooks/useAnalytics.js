import { useState, useEffect, useRef, useCallback } from 'react';

const MAX_POINTS = 100;

// Analytics hook for tracking user interactions and performance
export function useAnalytics(options = {}) {
  const { 
    enableTracking = true,
    endpoint = '/api/analytics',
    userId = null,
    sessionId = null 
  } = options;

  const [isInitialized, setIsInitialized] = useState(false);
  const [events, setEvents] = useState([]);
  const [pageViews, setPageViews] = useState(0);

  // The queue lives in a ref as well as in state: `trackEvent` used to read
  // `events.length` from its render closure, so a burst of events (or the
  // mount effect) never crossed the auto-flush threshold, and a flush cleared
  // every event - including ones recorded while the request was in flight.
  const queueRef = useRef([]);
  const sessionStartRef = useRef(null);
  const pageViewsRef = useRef(0);
  const flushingRef = useRef(false);

  const flushEvents = useCallback(async () => {
    if (!enableTracking || queueRef.current.length === 0) return;
    if (flushingRef.current) return;

    const batch = queueRef.current.slice();
    const batchIds = new Set(batch.map((event) => event.id));
    flushingRef.current = true;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          events: batch,
          sessionStart: sessionStartRef.current?.toISOString(),
          pageViews: pageViewsRef.current,
        }),
      });

      if (response.ok) {
        // Only drop the events that were actually sent. Anything tracked
        // while the request was open stays queued for the next flush.
        queueRef.current = queueRef.current.filter((event) => !batchIds.has(event.id));
        setEvents(queueRef.current);
      }
    } catch (error) {
      console.error('Failed to send analytics:', error);
    } finally {
      flushingRef.current = false;
    }
  }, [endpoint, enableTracking]);

  const trackEvent = useCallback((eventName, data = {}) => {
    if (!enableTracking) return;

    const event = {
      id: generateEventId(),
      timestamp: new Date().toISOString(),
      eventName,
      data,
      userId,
      sessionId,
      url: window.location.href,
      userAgent: navigator.userAgent,
      referrer: document.referrer,
    };

    queueRef.current = [...queueRef.current, event];
    setEvents(queueRef.current);

    // Auto-flush if event queue gets too large
    if (queueRef.current.length > 50) {
      flushEvents();
    }
  }, [enableTracking, userId, sessionId, flushEvents]);

  const trackPageView = useCallback(() => {
    pageViewsRef.current += 1;
    setPageViews(pageViewsRef.current);
    trackEvent('page_view', {
      title: document.title,
      path: window.location.pathname
    });
  }, [trackEvent]);

  // Initialize analytics
  useEffect(() => {
    if (enableTracking) {
      const start = new Date();
      sessionStartRef.current = start;
      setIsInitialized(true);

      // Track initial page view
      trackPageView();

      // Track page visibility changes
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          trackEvent('page_visible', { timestamp: new Date() });
        } else {
          trackEvent('page_hidden', { timestamp: new Date() });
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        flushEvents(); // Send remaining events on unmount
      };
    }
  }, [enableTracking, trackPageView, trackEvent, flushEvents]);

  const trackInteraction = useCallback((element, action, data = {}) => {
    trackEvent('user_interaction', {
      element,
      action,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }, [trackEvent]);

  const trackPerformance = useCallback((metrics) => {
    trackEvent('performance_metrics', {
      ...metrics,
      timestamp: new Date().toISOString(),
    });
  }, [trackEvent]);

  const trackError = useCallback((error, context = {}) => {
    trackEvent('error', {
      message: error.message,
      stack: error.stack,
      ...context,
      timestamp: new Date().toISOString(),
    });
  }, [trackEvent]);

  // Auto-flush events periodically
  useEffect(() => {
    const interval = setInterval(() => {
      flushEvents();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [flushEvents]);

  return {
    isInitialized,
    trackEvent,
    trackPageView,
    trackInteraction,
    trackPerformance,
    trackError,
    events,
    pageViews,
    flushEvents,
  };
}

// Generate unique event ID
function generateEventId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// User behavior tracking hook
export function useUserBehavior(options = {}) {
  const { 
    enableTracking = true,
    throttleMs = 100
  } = options;

  const [mouseMovements, setMouseMovements] = useState([]);
  const [clicks, setClicks] = useState([]);
  const [scrolls, setScrolls] = useState([]);
  const [timeOnPage, setTimeOnPage] = useState(0);
  const [activeElement, setActiveElement] = useState(null);

  const startTimeRef = useRef(Date.now());
  const lastScrollRef = useRef(0);
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const requestRef = useRef();

  // Track time on page
  useEffect(() => {
    if (!enableTracking) return;

    const interval = setInterval(() => {
      setTimeOnPage(Date.now() - startTimeRef.current);
    }, 1000);

    return () => clearInterval(interval);
  }, [enableTracking]);

  // Track mouse movements with throttling
  useEffect(() => {
    if (!enableTracking) return;

    const handleMouseMove = (event) => {
      mousePositionRef.current = { x: event.clientX, y: event.clientY };

      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }

      requestRef.current = requestAnimationFrame(() => {
        setMouseMovements(prev => [...prev.slice(-(MAX_POINTS - 1)), {
          x: event.clientX,
          y: event.clientY,
          timestamp: Date.now(),
        }]);
      });
    };

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [enableTracking]);

  // Track clicks
  useEffect(() => {
    if (!enableTracking) return;

    const handleClick = (event) => {
      // Cap the buffer: clicks were appended forever and leaked memory for
      // anyone who left the tab open.
      setClicks(prev => [...prev.slice(-(MAX_POINTS - 1)), {
        x: event.clientX,
        y: event.clientY,
        target: event.target.tagName,
        id: event.target.id,
        className: event.target.className,
        timestamp: Date.now(),
      }]);
    };

    document.addEventListener('click', handleClick);

    return () => document.removeEventListener('click', handleClick);
  }, [enableTracking]);

  // Track scrolls with debouncing
  useEffect(() => {
    if (!enableTracking) return;

    const handleScroll = () => {
      const scrollTop = window.pageYOffset || 0;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      const scrollable = scrollHeight - clientHeight;
      // Pages shorter than the viewport cannot scroll; dividing by zero made
      // every recorded point NaN.
      const scrollPercentage =
        scrollable > 0 ? Math.min(100, (scrollTop / scrollable) * 100) : 0;

      setScrolls(prev => [...prev, {
        scrollTop,
        scrollHeight,
        clientHeight,
        scrollPercentage,
        timestamp: Date.now(),
      }]);

      lastScrollRef.current = scrollTop;
    };

    const throttledScroll = throttle(handleScroll, throttleMs);
    window.addEventListener('scroll', throttledScroll, { passive: true });

    return () => window.removeEventListener('scroll', throttledScroll);
  }, [enableTracking, throttleMs]);

  // Track active element
  useEffect(() => {
    if (!enableTracking) return;

    const handleFocus = (event) => {
      setActiveElement({
        tag: event.target.tagName,
        id: event.target.id,
        className: event.target.className,
        type: event.target.type,
        name: event.target.name,
        timestamp: Date.now(),
      });
    };

    const handleBlur = () => {
      setActiveElement(null);
    };

    document.addEventListener('focus', handleFocus, true);
    document.addEventListener('blur', handleBlur, true);

    return () => {
      document.removeEventListener('focus', handleFocus, true);
      document.removeEventListener('blur', handleBlur, true);
    };
  }, [enableTracking]);

  // Throttle function
  function throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  return {
    mouseMovements,
    clicks,
    scrolls,
    timeOnPage,
    activeElement,
    getHeatmapData: () => {
      // Process mouse movements for heatmap
      const heatmapData = [];
      mouseMovements.forEach(move => {
        heatmapData.push({
          x: move.x,
          y: move.y,
          value: 1,
        });
      });
      return heatmapData;
    },
    getClickDensity: () => {
      // Calculate click density by area
      const clickCounts = {};
      clicks.forEach(click => {
        const key = `${Math.floor(click.x / 100)},${Math.floor(click.y / 100)}`;
        clickCounts[key] = (clickCounts[key] || 0) + 1;
      });
      return clickCounts;
    },
  };
}

// SEO and metadata tracking hook
export function useSEOMetadata(options = {}) {
  const { 
    enableTracking = true,
    defaultTitle = 'NaijaTaste AI',
    defaultDescription = 'Discover Nigerian cuisine with AI-powered recommendations' 
  } = options;

  const [metadata, setMetadata] = useState({
    title: defaultTitle,
    description: defaultDescription,
    keywords: [],
    og: {},
    twitter: {},
  });

  const updateMetadata = useCallback((newMetadata) => {
    setMetadata(prev => ({ ...prev, ...newMetadata }));
    
    // Update document metadata
    if (typeof document !== 'undefined') {
      document.title = newMetadata.title || defaultTitle;
      
      // Update meta tags
      const metaTags = document.querySelectorAll('meta');
      metaTags.forEach(tag => {
        if (tag.name === 'description') {
          tag.setAttribute('content', newMetadata.description || defaultDescription);
        }
      });
    }
  }, [defaultTitle, defaultDescription]);

  const trackPageMetadata = useCallback(() => {
    if (!enableTracking) return;

    const pageMetadata = {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || defaultDescription,
      keywords: document.querySelector('meta[name="keywords"]')?.content?.split(',').map(k => k.trim()) || [],
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };

    // Open Graph tags
    const ogTags = {};
    document.querySelectorAll('meta[property^="og:"]').forEach(tag => {
      const property = tag.getAttribute('property');
      const content = tag.getAttribute('content');
      ogTags[property] = content;
    });

    // Twitter tags
    const twitterTags = {};
    document.querySelectorAll('meta[name^="twitter:"]').forEach(tag => {
      const name = tag.getAttribute('name');
      const content = tag.getAttribute('content');
      twitterTags[name] = content;
    });

    updateMetadata({ og: ogTags, twitter: twitterTags });
    return pageMetadata;
  }, [enableTracking, defaultDescription, updateMetadata]);

  return {
    metadata,
    updateMetadata,
    trackPageMetadata,
  };
}