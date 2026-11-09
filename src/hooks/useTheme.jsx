import { useState, useEffect, useCallback, memo } from 'react';

// Dark mode hook with system preference detection
export function useDarkMode(options = {}) {
  const { 
    defaultValue = false,
    storageKey = 'dark-mode',
    className = 'dark',
    enableSystemPreference = true 
  } = options;

  const [isDarkMode, setIsDarkMode] = useState(defaultValue);
  const [isSystemDark, setIsSystemDark] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Detect system preference
  useEffect(() => {
    if (!enableSystemPreference) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsSystemDark(mediaQuery.matches);

    const handleChange = (event) => {
      setIsSystemDark(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [enableSystemPreference]);

  // Load from localStorage or system preference
  useEffect(() => {
    const storedValue = localStorage.getItem(storageKey);
    
    if (storedValue !== null) {
      setIsDarkMode(storedValue === 'true');
    } else if (enableSystemPreference) {
      setIsDarkMode(isSystemDark);
    }
    
    setIsInitialized(true);
  }, [storageKey, enableSystemPreference, isSystemDark]);

  // Apply dark mode class to document
  useEffect(() => {
    if (!isInitialized) return;

    if (isDarkMode) {
      document.documentElement.classList.add(className);
    } else {
      document.documentElement.classList.remove(className);
    }
  }, [isDarkMode, className, isInitialized]);

  const toggleDarkMode = useCallback(() => {
    const newValue = !isDarkMode;
    setIsDarkMode(newValue);
    localStorage.setItem(storageKey, newValue.toString());
  }, [isDarkMode, storageKey]);

  const setDarkMode = useCallback((value) => {
    setIsDarkMode(value);
    localStorage.setItem(storageKey, value.toString());
  }, [storageKey]);

  return {
    isDarkMode,
    isSystemDark,
    isInitialized,
    toggleDarkMode,
    setDarkMode,
  };
}

// Theme provider component
export const ThemeProvider = memo(({ children, darkMode }) => {
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return children;
});

ThemeProvider.displayName = 'ThemeProvider';

// Color scheme utilities
export const ColorSchemes = {
  light: {
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#333333',
    textSecondary: '#666666',
    border: '#e0e0e0',
    primary: '#ff7300',
    primaryHover: '#e56300',
    secondary: '#6c757d',
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
    info: '#17a2b8',
    shadow: 'rgba(0, 0, 0, 0.1)',
    shadowHover: 'rgba(0, 0, 0, 0.15)',
  },
  dark: {
    background: '#1a1a1a',
    surface: '#2d2d2d',
    text: '#ffffff',
    textSecondary: '#cccccc',
    border: '#404040',
    primary: '#ff8c42',
    primaryHover: '#ff7300',
    secondary: '#6c757d',
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
    info: '#17a2b8',
    shadow: 'rgba(0, 0, 0, 0.3)',
    shadowHover: 'rgba(0, 0, 0, 0.4)',
  },
};

// Theme switcher component
export const ThemeSwitcher = memo(({ 
  className = '' 
}) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <button
      onClick={toggleDarkMode}
      className={className}
      style={{
        padding: '8px 16px',
        borderRadius: '20px',
        border: '1px solid #ccc',
        background: isDarkMode ? '#2d2d2d' : '#ffffff',
        color: isDarkMode ? '#ffffff' : '#333333',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
      }}
      aria-label="Toggle dark mode"
    >
      {isDarkMode ? '🌙 Dark' : '☀️ Light'}
    </button>
  );
});

ThemeSwitcher.displayName = 'ThemeSwitcher';

// High contrast mode hook
export function useHighContrast(options = {}) {
  const { 
    defaultValue = false,
    storageKey = 'high-contrast',
    className = 'high-contrast' 
  } = options;

  const [isHighContrast, setIsHighContrast] = useState(defaultValue);

  useEffect(() => {
    const storedValue = localStorage.getItem(storageKey);
    if (storedValue !== null) {
      setIsHighContrast(storedValue === 'true');
    }
  }, [storageKey]);

  useEffect(() => {
    if (isHighContrast) {
      document.documentElement.classList.add(className);
    } else {
      document.documentElement.classList.remove(className);
    }
  }, [isHighContrast, className]);

  const toggleHighContrast = useCallback(() => {
    const newValue = !isHighContrast;
    setIsHighContrast(newValue);
    localStorage.setItem(storageKey, newValue.toString());
  }, [isHighContrast, storageKey]);

  const setHighContrast = useCallback((value) => {
    setIsHighContrast(value);
    localStorage.setItem(storageKey, value.toString());
  }, [storageKey]);

  return {
    isHighContrast,
    toggleHighContrast,
    setHighContrast,
  };
}

// Reduced motion hook
export function useReducedMotion(options = {}) {
  const { 
    defaultValue = false,
    storageKey = 'reduced-motion' 
  } = options;

  const [isReducedMotion, setIsReducedMotion] = useState(defaultValue);

  useEffect(() => {
    const storedValue = localStorage.getItem(storageKey);
    if (storedValue !== null) {
      setIsReducedMotion(storedValue === 'true');
    } else {
      // Check system preference
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setIsReducedMotion(mediaQuery.matches);
    }
  }, [storageKey]);

  useEffect(() => {
    if (isReducedMotion) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }
  }, [isReducedMotion]);

  const toggleReducedMotion = useCallback(() => {
    const newValue = !isReducedMotion;
    setIsReducedMotion(newValue);
    localStorage.setItem(storageKey, newValue.toString());
  }, [isReducedMotion, storageKey]);

  const setReducedMotion = useCallback((value) => {
    setIsReducedMotion(value);
    localStorage.setItem(storageKey, value.toString());
  }, [storageKey]);

  return {
    isReducedMotion,
    toggleReducedMotion,
    setReducedMotion,
  };
}

// Font size hook
export function useFontSize(options = {}) {
  const { 
    defaultValue = 'medium',
    storageKey = 'font-size',
    sizes = {
      small: '12px',
      medium: '16px',
      large: '20px',
      xlarge: '24px',
    } 
  } = options;

  const [fontSize, setFontSize] = useState(defaultValue);

  useEffect(() => {
    const storedValue = localStorage.getItem(storageKey);
    if (storedValue && sizes[storedValue]) {
      setFontSize(storedValue);
    }
  }, [storageKey, sizes]);

  useEffect(() => {
    document.documentElement.style.fontSize = sizes[fontSize];
  }, [fontSize, sizes]);

  const setFontSizeHandler = useCallback((newSize) => {
    if (sizes[newSize]) {
      setFontSize(newSize);
      localStorage.setItem(storageKey, newSize);
    }
  }, [sizes, storageKey]);

  return {
    fontSize,
    setFontSize: setFontSizeHandler,
    sizes,
  };
}

// Theme customization hook
export function useThemeCustomization(options = {}) {
  const { 
    defaultTheme = 'light',
    defaultColors = {},
    storageKey = 'theme-customization' 
  } = options;

  const [theme, setTheme] = useState(defaultTheme);
  const [customColors, setCustomColors] = useState(defaultColors);
  const [isCustomizing, setIsCustomizing] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      setTheme(parsed.theme || defaultTheme);
      setCustomColors(parsed.customColors || defaultColors);
    }
  }, [defaultTheme, defaultColors, storageKey]);

  useEffect(() => {
    // Apply theme and custom colors
    const root = document.documentElement;
    
    // Apply theme
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Apply custom colors
    Object.entries(customColors).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
  }, [theme, customColors]);

  const updateTheme = useCallback((newTheme) => {
    setTheme(newTheme);
    const updated = { theme: newTheme, customColors };
    localStorage.setItem(storageKey, JSON.stringify(updated));
  }, [customColors, storageKey]);

  const updateColor = useCallback((key, value) => {
    const newColors = { ...customColors, [key]: value };
    setCustomColors(newColors);
    const updated = { theme, customColors: newColors };
    localStorage.setItem(storageKey, JSON.stringify(updated));
  }, [theme, customColors, storageKey]);

  const resetTheme = useCallback(() => {
    setTheme(defaultTheme);
    setCustomColors(defaultColors);
    localStorage.setItem(storageKey, JSON.stringify({
      theme: defaultTheme,
      customColors: defaultColors,
    }));
  }, [defaultTheme, defaultColors, storageKey]);

  const startCustomizing = useCallback(() => {
    setIsCustomizing(true);
  }, []);

  const stopCustomizing = useCallback(() => {
    setIsCustomizing(false);
  }, []);

  return {
    theme,
    customColors,
    isCustomizing,
    updateTheme,
    updateColor,
    resetTheme,
    startCustomizing,
    stopCustomizing,
  };
}