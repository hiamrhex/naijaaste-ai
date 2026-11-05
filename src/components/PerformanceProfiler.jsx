import { useState, useEffect, useRef, useCallback, memo, Profiler as ReactProfiler } from 'react';

// Performance profiler component for measuring component performance
export const Profiler = memo(({ 
  id, 
  children, 
  onRender, 
  metrics = true,
  showOnlySlowRenders = false,
  threshold = 16 // 16ms = 60fps
}) => {
  const [renderTime, setRenderTime] = useState(0);
  const [isSlow, setIsSlow] = useState(false);
  const [renderCount, setRenderCount] = useState(0);
  const totalTimeRef = useRef(0);
  const renderCountRef = useRef(0);

  const onRenderCallback = useCallback((
    id, // the "id" prop of the Profiler tree that has just committed
    phase, // either "mount" (if the tree just mounted) or "update" (if it re-rendered)
    actualDuration, // time spent rendering the committed update
    baseDuration, // estimated time to render the entire subtree without memoization
    _startTime, // when React began rendering this update
    _commitTime, // when React committed this update
    _interactions // the Set of interactions belonging to this update
  ) => {
    renderCountRef.current += 1;
    totalTimeRef.current += actualDuration;
    setRenderTime(actualDuration);
    setIsSlow(actualDuration > threshold);
    setRenderCount(renderCountRef.current);

    onRender?.({
      id,
      phase,
      actualDuration,
      baseDuration,
      isSlow: actualDuration > threshold,
      renderCount: renderCountRef.current,
      averageTime: totalTimeRef.current / renderCountRef.current,
    });
  }, [onRender, threshold]);

  const renderChildren = useCallback(() => {
    // showOnlySlowRenders keeps the tree but drops the badge on fast renders.
    if (metrics && (!showOnlySlowRenders || isSlow)) {
      return (
        <div className="performance-metrics" style={{
          position: 'relative',
          border: isSlow ? '2px solid red' : '1px solid #ccc',
          padding: '4px',
          margin: '4px',
          borderRadius: '4px',
          fontSize: '12px',
          background: isSlow ? 'rgba(255, 0, 0, 0.1)' : 'rgba(0, 255, 0, 0.1)',
        }}>
          {children}
          <div style={{
            position: 'absolute',
            top: -20,
            right: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '10px',
          }}>
            {renderTime.toFixed(1)}ms {isSlow ? '(SLOW)' : ''} · #{renderCount}
          </div>
        </div>
      );
    }
    return children;
  }, [children, metrics, renderTime, isSlow, showOnlySlowRenders]);

  return (
    <ReactProfiler id={id} onRender={onRenderCallback}>
      {renderChildren()}
    </ReactProfiler>
  );
});

Profiler.displayName = 'Profiler';

// Component for displaying performance metrics
export const PerformanceMetrics = memo(({ 
  metrics, 
  isVisible = false, 
  position = 'top-right' 
}) => {
  if (!isVisible) return null;

  const getPositionStyle = () => {
    const baseStyle = {
      position: 'fixed',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '8px',
      borderRadius: '4px',
      fontSize: '12px',
      zIndex: 9999,
      fontFamily: 'monospace',
    };

    switch (position) {
      case 'top-right':
        return { ...baseStyle, top: 10, right: 10 };
      case 'top-left':
        return { ...baseStyle, top: 10, left: 10 };
      case 'bottom-right':
        return { ...baseStyle, bottom: 10, right: 10 };
      case 'bottom-left':
        return { ...baseStyle, bottom: 10, left: 10 };
      default:
        return baseStyle;
    }
  };

  return (
    <div style={getPositionStyle()}>
      <div><strong>Performance Metrics</strong></div>
      <div>Render Time: {metrics.renderTime?.toFixed(2)}ms</div>
      <div>Memoization Hits: {metrics.memoizationHits || 0}</div>
      <div>Memoization Misses: {metrics.memoizationMisses || 0}</div>
      <div>Active Memoizations: {metrics.activeMemoizations || 0}</div>
      <div>Bundle Size: {metrics.bundleSize || 'Unknown'}</div>
      <div>Memory Usage: {metrics.memoryUsage || 'Unknown'}</div>
    </div>
  );
});

PerformanceMetrics.displayName = 'PerformanceMetrics';

// Hook for measuring component performance
export function useComponentPerformance(componentName) {
  const [metrics, setMetrics] = useState({
    renderTime: 0,
    renderCount: 0,
    totalTime: 0,
    averageTime: 0,
    lastRender: null,
  });

  const onRender = useCallback((data) => {
    setMetrics(prev => ({
      renderTime: data.actualDuration,
      renderCount: data.renderCount,
      totalTime: prev.totalTime + data.actualDuration,
      averageTime: (prev.totalTime + data.actualDuration) / (prev.renderCount + 1),
      lastRender: new Date(),
    }));
  }, []);

  return {
    componentName,
    metrics,
    onRender,
    isSlow: metrics.renderTime > 16,
    getPerformanceScore: () => {
      if (metrics.averageTime === 0) return 100;
      return Math.max(0, 100 - (metrics.averageTime / 16) * 100);
    },
  };
}

// Hook for measuring memory usage
export function useMemoryUsage() {
  const [memory, setMemory] = useState({
    used: 0,
    total: 0,
    percentage: 0,
  });

  const measureMemory = useCallback(() => {
    if ('memory' in performance) {
      const memoryInfo = performance.memory;
      setMemory({
        used: memoryInfo.usedJSHeapSize,
        total: memoryInfo.totalJSHeapSize,
        percentage: (memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize) * 100,
      });
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(measureMemory, 5000);
    return () => clearInterval(interval);
  }, [measureMemory]);

  return memory;
}

// Hook for measuring bundle size
export function useBundleSize() {
  const [bundleInfo, setBundleInfo] = useState({
    size: 0,
    chunks: [],
    loaded: false,
  });

  useEffect(() => {
    // Read one frame after mount so the resource timing buffer already holds
    // the bundles that were just fetched. Deferring also avoids a synchronous
    // setState inside the effect, which forces a second render pass.
    const frame = requestAnimationFrame(() => {
      if (window.performance && window.performance.getEntriesByType) {
        const resources = performance.getEntriesByType('resource');
        const jsResources = resources.filter(r => r.name.includes('.js'));

        const totalSize = jsResources.reduce((sum, resource) => sum + resource.transferSize, 0);

        setBundleInfo({
          size: totalSize,
          chunks: jsResources.map(r => ({
            name: r.name,
            size: r.transferSize,
            duration: r.duration,
          })),
          loaded: true,
        });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  return bundleInfo;
}

// Performance monitoring dashboard
export const PerformanceDashboard = memo(({ isVisible = false, metrics = {} }) => {
  const memory = useMemoryUsage();
  const bundleInfo = useBundleSize();

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 10,
      left: 10,
      background: 'rgba(0, 0, 0, 0.9)',
      color: 'white',
      padding: '16px',
      borderRadius: '8px',
      fontSize: '14px',
      fontFamily: 'monospace',
      minWidth: '300px',
      zIndex: 9999,
    }}>
      <h3>Performance Dashboard</h3>
      
      <div style={{ marginBottom: '16px' }}>
        <h4>Memory Usage</h4>
        <div>
          Used: {(memory.used / 1024 / 1024).toFixed(2)} MB / 
          {(memory.total / 1024 / 1024).toFixed(2)} MB 
          ({memory.percentage.toFixed(1)}%)
        </div>
        <div style={{
          width: '100%',
          height: '8px',
          background: '#333',
          borderRadius: '4px',
          overflow: 'hidden',
          marginTop: '4px',
        }}>
          <div style={{
            width: `${Math.min(memory.percentage, 100)}%`,
            height: '100%',
            background: memory.percentage > 80 ? '#ff4444' : '#44ff44',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <h4>Bundle Size</h4>
        <div>
          Total: {(bundleInfo.size / 1024).toFixed(2)} KB
        </div>
        {bundleInfo.chunks.length > 0 && (
          <div style={{ marginTop: '8px', fontSize: '12px' }}>
            <div>Chunks:</div>
            {bundleInfo.chunks.slice(0, 5).map((chunk, index) => (
              <div key={index} style={{ marginLeft: '12px' }}>
                {chunk.name.split('/').pop()}: {(chunk.size / 1024).toFixed(2)} KB
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h4>Component Metrics</h4>
        {Object.entries(metrics).map(([component, data]) => (
          <div key={component} style={{ marginBottom: '8px' }}>
            <strong>{component}:</strong> {data.renderTime.toFixed(2)}ms 
            {data.isSlow && ' (SLOW)'}
          </div>
        ))}
      </div>
    </div>
  );
});

PerformanceDashboard.displayName = 'PerformanceDashboard';