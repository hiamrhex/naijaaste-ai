import { useState, useEffect, useRef, useCallback, memo } from 'react';

const DEFAULT_SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de', 'ja'];
const DEFAULT_MESSAGES = {};
const RTL_LOCALES = ['ar', 'he', 'fa', 'ur'];

// Internationalization (i18n) hook for multilingual support
export function useI18n(options = {}) {
  const { 
    defaultLocale = 'en',
    fallbackLocale = 'en',
    supportedLocales = DEFAULT_SUPPORTED_LOCALES,
    messages = DEFAULT_MESSAGES,
    storageKey = 'locale',
    enableRTL = false 
  } = options;

  const [locale, setLocale] = useState(defaultLocale);
  const [isRTL, setIsRTL] = useState(enableRTL);
  const [messagesLoaded, setMessagesLoaded] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Options are often passed as inline literals, so read them through refs to
  // keep the load effect from restarting on every render.
  const supportedLocalesRef = useRef(supportedLocales);
  const messagesRef = useRef(messages);
  useEffect(() => {
    supportedLocalesRef.current = supportedLocales;
  }, [supportedLocales]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const supportedLocalesKey = supportedLocales.join('|');
  const messagesKey = Object.keys(messages).join('|');

  const loadMessagesForLocale = useCallback(async (localeCode) => {
    // Check if we have pre-loaded messages
    const preloaded = messagesRef.current;
    if (preloaded[localeCode]) {
      return preloaded[localeCode];
    }

    // In a real app, you'd fetch from an API
    const response = await fetch(`/locales/${localeCode}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load messages for ${localeCode}`);
    }
    
    return response.json();
  }, []);

  const updateRTLDirection = useCallback((localeCode) => {
    setIsRTL(RTL_LOCALES.includes(localeCode));
  }, []);

  // Load messages from storage or API
  useEffect(() => {
    const loadMessages = async () => {
      setIsLoading(true);
      
      try {
        // Try to get from localStorage first
        const storedLocale = localStorage.getItem(storageKey);
        if (storedLocale && supportedLocalesRef.current.includes(storedLocale)) {
          setLocale(storedLocale);
        }

        // Load messages
        const loadedMessages = await loadMessagesForLocale(locale);
        setMessagesLoaded(prev => ({ ...prev, [locale]: loadedMessages }));
        
        // Update RTL direction
        updateRTLDirection(locale);
      } catch (error) {
        console.error('Failed to load messages:', error);
        // Fallback to default locale
        const fallbackMessages = await loadMessagesForLocale(fallbackLocale);
        setMessagesLoaded(prev => ({ ...prev, [fallbackLocale]: fallbackMessages }));
        setLocale(fallbackLocale);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [
    locale,
    storageKey,
    fallbackLocale,
    supportedLocalesKey,
    messagesKey,
    loadMessagesForLocale,
    updateRTLDirection,
  ]);

  const setLocaleHandler = useCallback(async (newLocale) => {
    if (!supportedLocalesRef.current.includes(newLocale)) {
      console.warn(`Locale ${newLocale} is not supported`);
      return;
    }

    setIsLoading(true);
    
    try {
      const loadedMessages = await loadMessagesForLocale(newLocale);
      setMessagesLoaded(prev => ({ ...prev, [newLocale]: loadedMessages }));
      setLocale(newLocale);
      
      // Store in localStorage
      localStorage.setItem(storageKey, newLocale);
      
      // Update RTL direction
      updateRTLDirection(newLocale);
      
      // Update document direction
      if (typeof document !== 'undefined') {
        document.documentElement.dir = RTL_LOCALES.includes(newLocale) ? 'rtl' : 'ltr';
        document.documentElement.lang = newLocale;
      }
    } catch (error) {
      console.error('Failed to set locale:', error);
    } finally {
      setIsLoading(false);
    }
  }, [storageKey, loadMessagesForLocale, updateRTLDirection]);

  const t = useCallback((key, params = {}) => {
    if (!messagesLoaded[locale]) {
      return key; // Return key if messages not loaded
    }

    let message = messagesLoaded[locale][key] || key;
    
    // Replace parameters in message
    Object.entries(params).forEach(([param, value]) => {
      message = message.replace(new RegExp(`{{${param}}}`, 'g'), value);
    });
    
    return message;
  }, [messagesLoaded, locale]);

  const formatNumber = useCallback((number, options = {}) => {
    return new Intl.NumberFormat(locale, options).format(number);
  }, [locale]);

  const formatDate = useCallback((date, options = {}) => {
    return new Intl.DateTimeFormat(locale, options).format(date);
  }, [locale]);

  const formatCurrency = useCallback((amount, currency = 'USD') => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amount);
  }, [locale]);

  const getRelativeTime = useCallback((date, options = {}) => {
    return new Intl.RelativeTimeFormat(locale, options).format(
      Math.round((date - new Date()) / (1000 * 60 * 60 * 24)),
      'day'
    );
  }, [locale]);

  return {
    locale,
    setLocale: setLocaleHandler,
    isLoading,
    t,
    formatNumber,
    formatDate,
    formatCurrency,
    getRelativeTime,
    isRTL,
    supportedLocales,
    messagesLoaded,
  };
}

// RTL direction provider component
export const RTLProvider = memo(({ children, isRTL }) => {
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    }
  }, [isRTL]);

  return children;
});

RTLProvider.displayName = 'RTLProvider';

// Language switcher component
export const LanguageSwitcher = memo(({ 
  currentLocale, 
  supportedLocales, 
  onLocaleChange,
  className = '' 
}) => {
  return (
    <select
      value={currentLocale}
      onChange={(e) => onLocaleChange(e.target.value)}
      className={className}
      style={{
        padding: '8px',
        borderRadius: '4px',
        border: '1px solid #ccc',
        background: 'white',
        cursor: 'pointer',
      }}
    >
      {supportedLocales.map((locale) => (
        <option key={locale} value={locale}>
          {locale.toUpperCase()}
        </option>
      ))}
    </select>
  );
});

LanguageSwitcher.displayName = 'LanguageSwitcher';

// Date formatting utilities
export const DateFormats = {
  short: { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  },
  medium: { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  },
  long: { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  },
  time: { 
    hour: '2-digit', 
    minute: '2-digit' 
  },
};

// Number formatting utilities
export const NumberFormats = {
  decimal: { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  },
  percent: { 
    style: 'percent', 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 1 
  },
  compact: { 
    notation: 'compact' 
  },
};

// Currency formatting utilities
export const CurrencyFormats = {
  USD: { 
    style: 'currency', 
    currency: 'USD' 
  },
  EUR: { 
    style: 'currency', 
    currency: 'EUR' 
  },
  GBP: { 
    style: 'currency', 
    currency: 'GBP' 
  },
  JPY: { 
    style: 'currency', 
    currency: 'JPY' 
  },
};

// Localization hook for specific features
export function useLocalization(options = {}) {
  const { 
    feature, 
    locale, 
    messages = {} 
  } = options;

  const getLocalizedFeature = useCallback(() => {
    if (!feature || !messages[locale]) {
      return feature;
    }

    return messages[locale][feature] || feature;
  }, [feature, locale, messages]);

  const getLocalizedList = useCallback((listKey, items) => {
    if (!messages[locale]?.[listKey]) {
      return items;
    }

    const localizedItems = items.map(item => {
      const localizedItem = messages[locale][listKey][item];
      return localizedItem || item;
    });

    return localizedItems;
  }, [locale, messages]);

  return {
    getLocalizedFeature,
    getLocalizedList,
  };
}