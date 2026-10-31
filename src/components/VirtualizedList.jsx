import { useState, useEffect, useRef, useCallback, memo } from 'react';

// Virtualized list component for better performance with large datasets
export const VirtualizedList = memo(({ 
  items, 
  itemHeight = 60, 
  containerHeight = 400, 
  renderItem,
  overscan = 5,
  className = '',
  style = {}
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const containerRef = useRef(null);
  const requestRef = useRef();
  const lastScrollTopRef = useRef(0);

  // Calculate visible items
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  // Handle scroll events with throttling
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const scrollTop = containerRef.current.scrollTop;
    setScrollTop(scrollTop);
    
    // Detect scrolling direction and stop animation
    if (scrollTop !== lastScrollTopRef.current) {
      setIsScrolling(true);
      lastScrollTopRef.current = scrollTop;
      
      // Clear previous timeout
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      
      // Set timeout to stop scrolling detection
      requestRef.current = requestAnimationFrame(() => {
        setIsScrolling(false);
      });
    }
  }, []);

  // Handle wheel events for smoother scrolling
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (!containerRef.current) return;
    
    containerRef.current.scrollTop += e.deltaY;
    handleScroll();
  }, [handleScroll]);

  // Clean up animation frame
  useEffect(() => {
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  // Render items with virtualization
  const renderItems = visibleItems.map((item, index) => {
    const actualIndex = startIndex + index;
    return (
      <div
        key={item.id || actualIndex}
        style={{
          position: 'absolute',
          top: actualIndex * itemHeight,
          left: 0,
          right: 0,
          height: itemHeight,
          ...renderItem(item, actualIndex),
        }}
      >
        {renderItem(item, actualIndex)}
      </div>
    );
  });

  return (
    <div
      ref={containerRef}
      className={`virtualized-container ${className}`}
      style={{
        height: containerHeight,
        overflowY: 'auto',
        position: 'relative',
        ...style,
      }}
      onScroll={handleScroll}
      onWheel={handleWheel}
    >
      <div
        style={{
          position: 'relative',
          height: totalHeight,
        }}
      >
        {renderItems}
      </div>
      
      {/* Loading indicator while scrolling */}
      {isScrolling && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: 'rgba(249, 115, 22, 0.2)',
          zIndex: 10,
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            background: 'var(--orange)',
            animation: 'pulse 1s ease-in-out infinite',
            width: `${(scrollTop / totalHeight) * 100}%`,
          }} />
        </div>
      )}
    </div>
  );
});

VirtualizedList.displayName = 'VirtualizedList';

// Hook for virtualized lists with additional features
export function useVirtualizedList(items, options = {}) {
  const {
    itemHeight = 60,
    containerHeight = 400,
    overscan = 5,
    threshold = 100,
  } = options;

  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isNearBottom, setIsNearBottom] = useState(false);
  const containerRef = useRef(null);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, clientHeight, scrollHeight } = containerRef.current;
    const newStart = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const newEnd = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + clientHeight) / itemHeight) + overscan
    );

    setVisibleRange({ start: newStart, end: newEnd });
    setScrollPosition(scrollTop);
    
    // Check if near bottom
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    setIsNearBottom(distanceFromBottom <= threshold);
  }, [items.length, itemHeight, overscan, threshold]);

  const scrollToIndex = useCallback((index, align = 'center') => {
    if (!containerRef.current) return;

    const scrollTop = calculateScrollPosition(index, align);
    containerRef.current.scrollTop = scrollTop;
    handleScroll();
  }, [handleScroll]);

  const calculateScrollPosition = useCallback((index, align = 'center') => {
    const itemTop = index * itemHeight;
    const itemBottom = itemTop + itemHeight;
    const containerHeight = containerRef.current?.clientHeight || 400;

    switch (align) {
      case 'start':
        return itemTop;
      case 'end':
        return itemBottom - containerHeight;
      case 'center':
      default:
        return itemTop - (containerHeight - itemHeight) / 2;
    }
  }, [itemHeight]);

  return {
    containerRef,
    visibleRange,
    scrollPosition,
    isNearBottom,
    handleScroll,
    scrollToIndex,
    totalHeight: items.length * itemHeight,
  };
}

// Helper function to create virtualized list components
export function createVirtualizedListComponent(renderItem, options = {}) {
  return memo(({ items, ...props }) => {
    const virtualizationProps = useVirtualizedList(items, options);
    
    return (
      <VirtualizedList
        items={items}
        renderItem={renderItem}
        {...virtualizationProps}
        {...props}
      />
    );
  });
}