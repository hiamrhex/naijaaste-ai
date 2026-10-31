import { useEffect, useState, useRef } from 'react';

// Performance monitoring hook for development
export function usePerformanceMonitor() {
  const [metrics, setMetrics] = useState({
    renderTime: 0,
    memoizationHits: 0,
    memoizationMisses: 0,
  });
  
  const renderStartRef = useRef(0);
  const renderCountRef = useRef(0);

  useEffect(() => {
    renderStartRef.current = performance.now();
    renderCountRef.current++;

    const measureRender = () => {
      const renderTime = performance.now() - renderStartRef.current;
      setMetrics(prev => ({
        ...prev,
        renderTime: Math.max(prev.renderTime, renderTime)
      }));
    };

    // Measure after render completes
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'measureRender') {
          measureRender();
        }
      }
    });

    observer.observe({ entryTypes: ['measure'] });

    return () => {
      observer.disconnect();
    };
  }, []);

  return metrics;
}

// Hook for tracking memoization effectiveness
export function useMemoizationTracker() {
  const [stats, setStats] = useState({
    hits: 0,
    misses: 0,
    activeMemoizations: 0,
  });

  const incrementHits = () => setStats(prev => ({ ...prev, hits: prev.hits + 1 }));
  const incrementMisses = () => setStats(prev => ({ ...prev, misses: prev.misses + 1 }));
  const setActiveMemoizations = (count) => setStats(prev => ({ ...prev, activeMemoizations: count }));

  return {
    ...stats,
    incrementHits,
    incrementMisses,
    setActiveMemoizations,
  };
}

// Component for displaying performance metrics in development
export function PerformanceMetrics({ metrics, isVisible = false }) {
  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 10,
      right: 10,
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 9999,
      minWidth: '200px',
    }}>
      <div><strong>Performance Metrics</strong></div>
      <div>Render Time: {metrics.renderTime.toFixed(2)}ms</div>
      <div>Memoization Hits: {metrics.memoizationHits}</div>
      <div>Memoization Misses: {metrics.memoizationMisses}</div>
      <div>Active Memoizations: {metrics.activeMemoizations}</div>
    </div>
  );
}