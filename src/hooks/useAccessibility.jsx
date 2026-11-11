import { useState, useEffect, useRef, useCallback, memo } from 'react';

// Accessibility hook for improving accessibility features
export function useAccessibility(options = {}) {
  const { 
    enableKeyboardNavigation = true,
    enableScreenReader = true,
    enableFocusManagement = true,
    highContrast = false 
  } = options;

  const [isKeyboardUser, setIsKeyboardUser] = useState(false);
  const [currentFocus, setCurrentFocus] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const liveRegionsRef = useRef(new Set());
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  // Detect keyboard user
  useEffect(() => {
    if (!enableKeyboardNavigation) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Tab') {
        setIsKeyboardUser(true);
      }
    };

    const handleMouseDown = () => {
      setIsKeyboardUser(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [enableKeyboardNavigation]);

  // Track reduced motion changes
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (event) => {
      setReducedMotion(event.matches);
    };

    // Older Safari only implements addListener/removeListener.
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
    return undefined;
  }, []);

  // Focus management
  const manageFocus = useCallback((element, options = {}) => {
    if (!enableFocusManagement) return;

    const { preventScroll = false } = options;
    
    if (element) {
      element.focus({ preventScroll });
      setCurrentFocus(element);
    }
  }, [enableFocusManagement]);

  // Announce to screen readers
  const announceToScreenReader = useCallback((message, priority = 'polite') => {
    if (!enableScreenReader) return;

    setAnnouncement(message);
    
    // Create live region for screen readers
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.position = 'absolute';
    liveRegion.style.left = '-10000px';
    liveRegion.style.width = '1px';
    liveRegion.style.height = '1px';
    liveRegion.style.overflow = 'hidden';
    liveRegion.textContent = message;

    document.body.appendChild(liveRegion);
    liveRegionsRef.current.add(liveRegion);

    // Remove after announcement
    setTimeout(() => {
      liveRegion.remove();
      liveRegionsRef.current.delete(liveRegion);
    }, 1000);
  }, [enableScreenReader]);

  // Drop any live region still waiting for its timeout when the tree unmounts.
  useEffect(() => () => {
    liveRegionsRef.current.forEach((node) => node.remove());
    liveRegionsRef.current.clear();
  }, []);

  // Skip to content link
  const SkipToContent = memo(({ href = '#main-content' }) => {
    if (!enableKeyboardNavigation) return null;

    return (
      <a
        href={href}
        style={{
          position: 'absolute',
          top: '-40px',
          left: '0',
          background: 'var(--orange)',
          color: 'white',
          padding: '8px',
          textDecoration: 'none',
          zIndex: 9999,
          borderRadius: '0 0 4px 0',
        }}
        onFocus={(e) => {
          e.target.style.top = '0';
        }}
        onBlur={(e) => {
          e.target.style.top = '-40px';
        }}
      >
        Skip to main content
      </a>
    );
  });

  SkipToContent.displayName = 'SkipToContent';

  // Focus trap for modals and dialogs
  const useFocusTrap = (containerRef, options = {}) => {
    const { 
      initialFocus = null,
      escapeToClose = true,
      onEscape 
    } = options;

    const previousActiveElement = useRef(null);

    const activate = useCallback(() => {
      if (!containerRef.current) return;

      previousActiveElement.current = document.activeElement;
      
      // Focus initial element or first focusable element
      const focusableElements = containerRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      const elementToFocus = initialFocus || focusableElements[0];
      if (elementToFocus) {
        elementToFocus.focus();
      }
    }, [containerRef, initialFocus]);

    const deactivate = useCallback(() => {
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }, []);

    const handleKeyDown = useCallback((event) => {
      if (event.key === 'Escape' && escapeToClose) {
        onEscape?.();
        deactivate();
      }
      
      // Focus trap logic
      if (event.key === 'Tab') {
        const container = containerRef.current;
        if (!container) return;

        const focusableElements = container.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (!firstElement || !lastElement) return;
        
        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
          }
        }
      }
    }, [containerRef, escapeToClose, onEscape, deactivate]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      container.addEventListener('keydown', handleKeyDown);

      return () => {
        container.removeEventListener('keydown', handleKeyDown);
      };
    }, [containerRef, handleKeyDown]);

    return { activate, deactivate };
  };

  return {
    isKeyboardUser,
    currentFocus,
    announcement,
    reducedMotion,
    manageFocus,
    announceToScreenReader,
    SkipToContent,
    useFocusTrap,
    highContrast,
  };
}

// ARIA utilities for better accessibility
export const ARIA = {
  // Generate accessible labels
  label: (text, options = {}) => {
    const { 
      hidden = false,
      id = null,
      required = false 
    } = options;

    return {
      'aria-label': text,
      ...(hidden && { 'aria-hidden': true }),
      ...(id && { 'aria-labelledby': id }),
      ...(required && { 'aria-required': true }),
    };
  },

  // Manage live regions
  liveRegion: (priority = 'polite') => ({
    'aria-live': priority,
    'aria-atomic': true,
  }),

  // Alert messages
  alert: (message) => ({
    role: 'alert',
    'aria-live': 'assertive',
    children: message,
  }),

  // Status messages
  status: (message) => ({
    role: 'status',
    'aria-live': 'polite',
    children: message,
  }),

  // Tab navigation
  tab: (isActive) => ({
    role: 'tab',
    'aria-selected': isActive,
    'aria-controls': `tabpanel-${isActive ? 'active' : 'inactive'}`,
  }),

  // Modal dialogs
  dialog: (isOpen) => ({
    role: 'dialog',
    'aria-modal': isOpen,
    'aria-labelledby': 'dialog-title',
    'aria-describedby': 'dialog-description',
  }),

  // Navigation
  navigation: () => ({
    role: 'navigation',
    'aria-label': 'Main navigation',
  }),

  // Search
  search: () => ({
    role: 'search',
    'aria-label': 'Search',
  }),
};

// Accessibility checker component
function checkColorContrast() {
  // Simplified color contrast check
  // In a real implementation, you'd use a proper color contrast library
  return [];
}

export const AccessibilityChecker = memo(({ 
  children, 
  onIssues = () => {} 
}) => {
  const [issues, setIssues] = useState([]);

  useEffect(() => {
    const checkAccessibility = () => {
      const newIssues = [];

      // Check for missing alt texts
      const images = document.querySelectorAll('img:not([alt])');
      if (images.length > 0) {
        newIssues.push({
          type: 'error',
          message: `${images.length} images missing alt text`,
          elements: Array.from(images),
        });
      }

      // Check for missing labels
      const inputs = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])');
      if (inputs.length > 0) {
        newIssues.push({
          type: 'warning',
          message: `${inputs.length} inputs missing labels`,
          elements: Array.from(inputs),
        });
      }

      // Check for color contrast
      const lowContrastElements = checkColorContrast();
      if (lowContrastElements.length > 0) {
        newIssues.push({
          type: 'error',
          message: `${lowContrastElements.length} elements with low color contrast`,
          elements: lowContrastElements,
        });
      }

      setIssues(newIssues);
      onIssues(newIssues);
    };

    // Run checks periodically
    const interval = setInterval(checkAccessibility, 30000);
    checkAccessibility(); // Initial check

    return () => clearInterval(interval);
  }, [onIssues]);

  if (issues.length === 0) {
    return children;
  }

  return (
    <div style={{ position: 'relative' }}>
      {children}
      <div style={{
        position: 'fixed',
        top: 10,
        right: 10,
        background: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        padding: '16px',
        borderRadius: '8px',
        fontSize: '14px',
        zIndex: 9999,
        maxWidth: '300px',
      }}>
        <h3>Accessibility Issues</h3>
        {issues.map((issue, index) => (
          <div key={index} style={{ marginBottom: '8px' }}>
            <div style={{ 
              color: issue.type === 'error' ? '#ff4444' : '#ffaa00',
              fontWeight: 'bold',
            }}>
              {issue.type.toUpperCase()}: {issue.message}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

AccessibilityChecker.displayName = 'AccessibilityChecker';