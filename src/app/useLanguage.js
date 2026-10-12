import { useContext } from 'react';
import { LanguageContext } from './language-context.js';
import { t as tr, greet } from '../copy.js';

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  const { lang } = ctx;
  return { ...ctx, t: (key, ...args) => tr(lang, key, ...args), greet: (name, hour) => greet(lang, name, hour) };
};
