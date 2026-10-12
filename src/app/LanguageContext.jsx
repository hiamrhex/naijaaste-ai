import { useState, useEffect, useMemo } from 'react';
import { LanguageContext } from './language-context.js';

const KEY = 'nt.lang.v1';

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem(KEY) === 'pg' ? 'pg' : 'en'; } catch { return 'en'; }
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, lang); } catch { /* private mode */ }
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang }), [lang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
