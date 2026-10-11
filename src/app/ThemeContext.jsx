import { useState, useEffect, useMemo } from 'react';
import { ThemeContext } from './theme-context.js';

const KEY = 'nt.theme.v1';

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try { return (localStorage.getItem(KEY) || 'dark') === 'dark'; } catch { return true; }
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, dark ? 'dark' : 'light'); } catch { /* private mode */ }
  }, [dark ]);

  const t = useMemo(() => (dark ? {
    "--bg-primary": "#080810",
    "--bg-secondary": "#0D0D1A",
    "--bg-card": "#111827",
    "--bg-card-hover": "#1A2332",
    "--border": "#1F2937",
    "--orange": "#F97316",
    "--orange-light": "rgba(249,115,22,0.1)",
    "--green": "#10B981",
    "--amber": "#F59E0B",
    "--text-primary": "#F9FAFB",
    "--text-secondary": "#D1D5DB",
    "--text-muted": "#9CA3AF",
    "--text-hint": "#6B7280",
    "--chat-user-bg": "#F97316",
    "--chat-user-text": "#ffffff",
    "--chat-bot-bg": "#1A2332",
    "--chat-bot-text": "#D1D5DB",
    "--input-bg": "#111827",
    "--header-bg": "rgba(8,8,16,0.92)",
  } : {
    "--bg-primary": "#FAFAF5",
    "--bg-secondary": "#F2EFE8",
    "--bg-card": "#FFFFFF",
    "--bg-card-hover": "#F8F5F0",
    "--border": "#E5E0D8",
    "--orange": "#EA6C14",
    "--orange-light": "rgba(234,108,20,0.08)",
    "--green": "#059669",
    "--amber": "#D97706",
    "--text-primary": "#111827",
    "--text-secondary": "#374151",
    "--text-muted": "#6B7280",
    "--text-hint": "#9CA3AF",
    "--chat-user-bg": "#EA6C14",
    "--chat-user-text": "#ffffff",
    "--chat-bot-bg": "#F0EDE6",
    "--chat-bot-text": "#374151",
    "--input-bg": "#FFFFFF",
    "--header-bg": "rgba(250,250,245,0.92)",
  }), [dark ]);

  const value = useMemo(() => ({ dark, setDark, toggle: () => setDark((d) => !d), t }), [dark, t]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
