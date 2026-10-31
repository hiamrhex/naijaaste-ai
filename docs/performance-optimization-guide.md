# Performance Optimization Guide for NaijaTaste AI

This document provides comprehensive guidance on the performance optimizations implemented in the NaijaTaste AI frontend application.

## Overview

The performance optimizations focus on improving:
- **Render Performance**: Reducing unnecessary re-renders with React.memo and useMemo
- **Bundle Size**: Optimizing with dynamic imports and code splitting
- **Build Performance**: Improving Vite configuration for faster builds
- **User Experience**: Implementing lazy loading and debouncing
- **Development Experience**: Adding performance monitoring and testing

## Key Optimizations Implemented

### 1. Component-Level Optimizations

#### React.memo Usage
```jsx
// Before
export default function HomeScreen() { ... }

// After
export default memo(function HomeScreen() { ... })
```

**Benefits**: Prevents unnecessary re-renders when props haven't changed.

#### useMemo for Expensive Calculations
```jsx
// Before
const currentHero = HERO_PHRASES[c.heroIdx];

// After
const currentHero = useMemo(() => HERO_PCRASES[c.heroIdx], [c.heroIdx]);
```

**Benefits**: Prevents recalculating values on every render.

#### Component Splitting
```jsx
// Split large components into smaller, focused ones
export const HeroSection = memo(({ heroIdx, heroVisible, currentHero }) => { ... });
export const StageBar = memo(({ stage, stageIdx }) => { ... });
```

**Benefits**: Improves re-render granularity and maintainability.

### 2. Dynamic Imports and Lazy Loading

#### Heavy Dependencies
```javascript
// Dynamic imports for heavy libraries
export const loadLeaflet = async () => {
  const L = await import('leaflet');
  await import('leaflet/dist/leaflet.css');
  return L;
};

export const loadLucideIcon = async (iconName) => {
  const iconModule = await import('lucide-react');
  return iconModule[iconName];
};
```

**Benefits**: Reduces initial bundle size and improves load times.

#### Dynamic Components
```jsx
export function DynamicIcon({ name, size = 24, className, ...props }) {
  const [IconComponent, setIconComponent] = useState(null);
  
  useEffect(() => {
    const loadIcon = async () => {
      const iconModule = await import('lucide-react');
      const Icon = iconModule[name];
      setIconComponent(() => Icon);
    };
    loadIcon();
  }, [name]);
  
  if (!IconComponent) return <div>Loading...</div>;
  return <IconComponent size={size} className={className} {...props} />;
}
```

**Benefits**: Icons load only when needed, reducing initial load time.

### 3. Build Optimization

#### Vite Configuration
```javascript
export default defineConfig({
  plugins: [
    react({ fastRefresh: true }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          lucide: ['lucide-react'],
          leaflet: ['leaflet'],
          google: ['@google/genai'],
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
  },
  optimizeDeps: {
    include: ['lucide-react', 'leaflet'],
  },
});
```

**Benefits**: 
- Faster development with fast refresh
- Better caching with chunk splitting
- Optimized dependency pre-bundling

### 4. Performance Monitoring

#### Performance Metrics
```jsx
export function PerformanceMetrics({ metrics, isVisible = false }) {
  if (!isVisible) return null;
  
  return (
    <div style={{ position: 'fixed', top: 10, right: 10, background: 'rgba(0,0,0,0.8)' }}>
      <div>Render Time: {metrics.renderTime.toFixed(2)}ms</div>
      <div>Memoization Hits: {metrics.memoizationHits}</div>
      <div>Memoization Misses: {metrics.memoizationMisses}</div>
    </div>
  );
}
```

**Benefits**: Real-time performance insights during development.

#### Optimization Hooks
```javascript
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
}
```

**Benefits**: Reduces unnecessary API calls and expensive operations.

### 5. CSS Optimizations

#### Utility Classes
```css
/* Optimized utility classes */
.flex { display: flex; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.justify-center { justify-content: center; }
.gap-sm { gap: 8px; }
.gap-md { gap: 12px; }
.gap-lg { gap: 16px; }
```

**Benefits**: Reduced CSS bundle size and faster styling.

#### Hardware Acceleration
```css
.transform { transform: translateZ(0); }
.will-change-transform { will-change: transform; }
.will-change-opacity { will-change: opacity; }
```

**Benefits**: Smoother animations and better performance.

## Performance Metrics

### Target Benchmarks
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **Time to Interactive**: < 3.5s
- **Bundle Size**: < 500KB (gzipped)

### Monitoring Performance
```javascript
const { renderTime, memoizationHits, memoizationMisses } = usePerformanceMonitor();

// Track in development
if (process.env.NODE_ENV === 'development') {
  console.log(`Render time: ${renderTime}ms`);
  console.log(`Memoization hit rate: ${memoizationHits / (memoizationHits + memoizationMisses) * 100}%`);
}
```

## Best Practices

### 1. When to Use React.memo
- Components with expensive rendering
- Components that re-render frequently with the same props
- Components deep in the component tree

### 2. When to Use useMemo
- Expensive calculations (arrays, objects, computations)
- Derived state that doesn't change often
- Values used in multiple places that should be consistent

### 3. When to Use useCallback
- Event handlers passed to child components
- Functions used in dependency arrays
- Callbacks that don't need to change on every render

### 4. Dynamic Import Strategy
- Load heavy libraries on demand (Leaflet, Chart.js, etc.)
- Lazy load route components
- Load icons only when needed

### 5. Performance Testing
- Use React DevTools Profiler to identify bottlenecks
- Monitor Lighthouse scores regularly
- Test on real devices and slow networks
- Use performance budgets in CI/CD

## Future Optimizations

### 1. Code Splitting
- Implement route-based code splitting
- Add component-level code splitting for heavy features
- Use React.lazy for Suspense boundaries

### 2. Image Optimization
- Implement WebP format support
- Add responsive images with srcset
- Use lazy loading for off-screen images

### 3. State Management
- Implement state normalization
- Use selectors for derived state
- Consider state management libraries for complex state

### 4. Caching Strategies
- Implement service worker caching
- Add API response caching
- Use localStorage for frequently accessed data

## Conclusion

These optimizations significantly improve the performance and user experience of the NaijaTaste AI application. By following these patterns and continuously monitoring performance, we ensure the application remains fast and responsive as it grows.

Remember: Performance optimization is an ongoing process. Regularly monitor metrics and be prepared to adapt as the application evolves.