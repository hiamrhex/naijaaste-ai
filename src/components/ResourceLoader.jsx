import { useState, useEffect, useRef, useCallback, memo } from 'react';

// A real, 1x1 transparent GIF. The previous placeholder value was the literal
// string 'data:image/svg+xml;base64,...' which every browser rejects, so lazy
// images flashed a broken-image icon until the real asset arrived.
const BLANK_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';


// Preloader component for optimizing resource loading
export const Preloader = memo(({ 
  resources, 
  onReady, 
  onError, 
  fallback = 'Loading...',
  className = '' 
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const loadedResources = useRef(new Set());

  // Declared before the effect that calls it: the old order relied on the
  // const being initialised later, which the hooks linter correctly rejects.
  const loadResource = useCallback(async (resource) => {
    if (typeof resource === 'string') {
      // Load image
      if (resource.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = reject;
          img.src = resource;
        });
      }

      // Load CSS
      if (resource.match(/\.(css)$/i)) {
        return new Promise((resolve, reject) => {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = resource;
          link.onload = resolve;
          link.onerror = reject;
          document.head.appendChild(link);
        });
      }

      // Load script
      if (resource.match(/\.(js)$/i)) {
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = resource; // was `src = resource`, an implicit global
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
    } else if (resource instanceof Promise) {
      return resource;
    }
  }, []);

  useEffect(() => {
    const loadResources = async () => {
      setLoading(true);
      setError(null);
      loadedResources.current.clear();
      setProgress(0);

      try {
        for (let i = 0; i < resources.length; i++) {
          const resource = resources[i];
          
          if (loadedResources.current.has(resource)) {
            setProgress(((i + 1) / resources.length) * 100);
            continue;
          }

          await loadResource(resource);
          loadedResources.current.add(resource);
          setProgress(((i + 1) / resources.length) * 100);
        }

        setLoading(false);
        onReady?.();
      } catch (err) {
        setError(err);
        onError?.(err);
        setLoading(false);
      }
    };

    loadResources();
  }, [resources, onReady, onError, loadResource]);

  if (error) {
    return <div className={`error ${className}`}>Error loading resources</div>;
  }

  if (loading) {
    return (
      <div className={`preloader ${className}`}>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="progress-text">{fallback}</div>
      </div>
    );
  }

  return null;
});

Preloader.displayName = 'Preloader';

// Resource loader component with caching
export const ResourceLoader = memo(({ 
  children, 
  cacheKey = 'default',
  preload = false 
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [cache, setCache] = useState(new Map());

  const loadResources = useCallback(async () => {
    if (cache.get(cacheKey)) {
      setIsLoaded(true);
      return;
    }

    try {
      // Simulate resource loading
      await new Promise(resolve => setTimeout(resolve, 1000));
      setCache(prev => new Map(prev).set(cacheKey, true));
      setIsLoaded(true);
    } catch (error) {
      console.error('Failed to load resources:', error);
    }
  }, [cache, cacheKey]);

  useEffect(() => {
    if (preload) {
      loadResources();
    }
  }, [preload, loadResources]);

  if (!isLoaded && !preload) {
    return <div>Loading resources...</div>;
  }

  return children;
});

ResourceLoader.displayName = 'ResourceLoader';

// Intersection Observer hook for lazy loading
export function useIntersectionObserver({
  threshold = 0.1,
  root = null,
  rootMargin = '0px',
  freezeOnceVisible = false,
}) {
  const [entry, setEntry] = useState();
  const [node, setNode] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  useEffect(() => {
    const element = node;
    if (!element) return;

    const observerInstance = new IntersectionObserver(
      ([entry]) => {
        setEntry(entry);
        const isVisible = entry.isIntersecting;
        setIsVisible(isVisible);
        
        if (isVisible && freezeOnceVisible) {
          observerInstance.unobserve(element);
        }
        
        if (isVisible) {
          setHasBeenVisible(true);
        }
      },
      {
        threshold,
        root,
        rootMargin,
      }
    );

    observerInstance.observe(element);

    return () => {
      observerInstance.unobserve(element);
    };
  }, [node, threshold, root, rootMargin, freezeOnceVisible]);

  return {
    ref: setNode,
    entry,
    isVisible,
    hasBeenVisible,
  };
}

// Lazy image component with intersection observer
export const LazyImage = memo(({ 
  src, 
  alt, 
  placeholder = BLANK_PIXEL,
  className = '',
  onLoad,
  onError,
  ...props 
}) => {
  const { ref, isVisible } = useIntersectionObserver({
    threshold: 0.1,
    freezeOnceVisible: true,
  });

  const [imageSrc, setImageSrc] = useState(placeholder);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (isVisible && src !== imageSrc) {
      const img = new Image();
      img.onload = () => {
        setImageSrc(src);
        setImageLoaded(true);
        setImageError(false);
        onLoad?.();
      };
      img.onerror = () => {
        setImageError(true);
        onError?.();
      };
      img.src = src;
    }
  }, [isVisible, src, imageSrc, onLoad, onError]);

  return (
    <img
      ref={ref}
      src={imageSrc}
      alt={alt}
      className={`${className} ${imageLoaded ? 'loaded' : ''} ${imageError ? 'error' : ''}`}
      loading="lazy"
      {...props}
    />
  );
});

LazyImage.displayName = 'LazyImage';

// Optimized image loader with multiple formats
export const OptimizedImage = memo(({ 
  src, 
  alt, 
  placeholder = BLANK_PIXEL,
  className = '',
  ...props 
}) => {
  const [currentSrc, setCurrentSrc] = useState(placeholder);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadImage = useCallback(async () => {
    try {
      // In a real implementation, you'd have different versions for each format
      const img = new Image();
      img.onload = () => {
        setCurrentSrc(src);
        setLoading(false);
        setError(false);
      };
      img.onerror = () => {
        setError(true);
        setLoading(false);
      };
      img.src = src;
    } catch (err) {
      console.error('Failed to load image:', err);
    }
  }, [src]);

  useEffect(() => {
    if (src) {
      loadImage();
    }
  }, [src, loadImage]);

  if (error) {
    return <div className={`image-error ${className}`}>Failed to load image</div>;
  }

  if (loading) {
    return <div className={`image-loading ${className}`}>Loading...</div>;
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      loading="lazy"
      {...props}
    />
  );
});

OptimizedImage.displayName = 'OptimizedImage';