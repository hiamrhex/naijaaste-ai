import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PerformanceMetrics, usePerformanceMonitor, useMemoizationTracker } from '../src/hooks/usePerformanceMonitor.js';

describe('PerformanceMetrics', () => {
  it('should not render when not visible', () => {
    render(<PerformanceMetrics metrics={{ renderTime: 0, memoizationHits: 0, memoizationMisses: 0 }} isVisible={false} />);
    expect(screen.queryByText('Performance Metrics')).toBeNull();
  });

  it('should render metrics when visible', () => {
    const metrics = { renderTime: 100, memoizationHits: 5, memoizationMisses: 2 };
    render(<PerformanceMetrics metrics={metrics} isVisible={true} />);
    
    expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
    expect(screen.getByText('Render Time: 100.00ms')).toBeInTheDocument();
    expect(screen.getByText('Memoization Hits: 5')).toBeInTheDocument();
    expect(screen.getByText('Memoization Misses: 2')).toBeInTheDocument();
  });
});

describe('usePerformanceMonitor', () => {
  it('should track render time', () => {
    const { result } = renderHook(() => usePerformanceMonitor());
    
    // Simulate some render time
    act(() => {
      vi.advanceTimersByTime(50);
    });
    
    expect(result.current.renderTime).toBeGreaterThan(0);
  });

  it('should initialize with default metrics', () => {
    const { result } = renderHook(() => usePerformanceMonitor());
    
    expect(result.current).toEqual({
      renderTime: 0,
      memoizationHits: 0,
      memoizationMisses: 0,
    });
  });
});

describe('useMemoizationTracker', () => {
  it('should track memoization hits and misses', () => {
    const { result } = renderHook(() => useMemoizationTracker());
    
    expect(result.current.hits).toBe(0);
    expect(result.current.misses).toBe(0);
    expect(result.current.activeMemoizations).toBe(0);
    
    act(() => {
      result.current.incrementHits();
      result.current.incrementMisses();
      result.current.setActiveMemoizations(3);
    });
    
    expect(result.current.hits).toBe(1);
    expect(result.current.misses).toBe(1);
    expect(result.current.activeMemoizations).toBe(3);
  });
});

// Component performance test
describe('Component Performance Tests', () => {
  it('should render optimized RestaurantCard efficiently', () => {
    const mockRestaurant = {
      id: 1,
      name: 'Test Restaurant',
      match_score: 0.85,
      price_tier: 'mid',
      signature_dishes: ['Jollof Rice'],
      cuisine_tags: ['Nigerian'],
    };

    const { container, rerender } = render(
      <RestaurantCard 
        rec={mockRestaurant} 
        index={0} 
        onReview={vi.fn()} 
        distanceKm={2.5}
        directionsUrl="https://maps.google.com"
        isFavorite={false}
        onToggleFavorite={vi.fn()}
      />
    );

    // First render
    const startTime = performance.now();
    rerender(
      <RestaurantCard 
        rec={mockRestaurant} 
        index={0} 
        onReview={vi.fn()} 
        distanceKm={2.5}
        directionsUrl="https://maps.google.com"
        isFavorite={false}
        onToggleFavorite={vi.fn()}
      />
    );
    const endTime = performance.now();
    
    // Render should be fast (less than 16ms for 60fps)
    expect(endTime - startTime).toBeLessThan(16);
    
    expect(screen.getByText('Test Restaurant')).toBeInTheDocument();
    expect(screen.getByText('85% match')).toBeInTheDocument();
  });

  it('should handle memoization in RestaurantCard', () => {
    const mockRestaurant = {
      id: 1,
      name: 'Test Restaurant',
      match_score: 0.85,
      price_tier: 'mid',
      signature_dishes: ['Jollof Rice'],
      cuisine_tags: ['Nigerian'],
    };

    const { rerender } = render(
      <RestaurantCard 
        rec={mockRestaurant} 
        index={0} 
        onReview={vi.fn()} 
        distanceKm={2.5}
        directionsUrl="https://maps.google.com"
        isFavorite={false}
        onToggleFavorite={vi.fn()}
      />
    );

    // Rerender with same props - should not cause re-render due to memoization
    const renderSpy = vi.spyOn(console, 'log');
    rerender(
      <RestaurantCard 
        rec={mockRestaurant} 
        index={0} 
        onReview={vi.fn()} 
        distanceKm={2.5}
        directionsUrl="https://maps.google.com"
        isFavorite={false}
        onToggleFavorite={vi.fn()}
      />
    );
    
    // No console logs should indicate re-render didn't happen
    expect(renderSpy).not.toHaveBeenCalled();
    renderSpy.mockRestore();
  });
});