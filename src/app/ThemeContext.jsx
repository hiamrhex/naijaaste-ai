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
    "--bg-primary": "#0C0E0A",
    "--bg-secondary": "#12150F",
    "--bg-card": "#171B13",
    "--bg-card-hover": "#1E2419",
    "--bg-input": "#141810",
    "--border": "#2A3024",
    "--border-hover": "#3C4434",
    "--orange": "#E4572E",
    "--orange-bright": "#F07A4A",
    "--orange-light": "rgba(228,87,46,0.12)",
    "--orange-08": "rgba(228,87,46,0.08)",
    "--orange-10": "rgba(228,87,46,0.10)",
    "--orange-15": "rgba(228,87,46,0.15)",
    "--orange-20": "rgba(228,87,46,0.20)",
    "--orange-25": "rgba(228,87,46,0.25)",
    "--orange-30": "rgba(228,87,46,0.30)",
    "--orange-40": "rgba(228,87,46,0.40)",
    "--orange-50": "rgba(228,87,46,0.50)",
    "--green": "#5FA97C",
    "--green-light": "rgba(95,169,124,0.12)",
    "--green-08": "rgba(95,169,124,0.08)",
    "--green-25": "rgba(95,169,124,0.25)",
    "--green-32": "rgba(95,169,124,0.32)",
    "--amber": "#E0A93B",
    "--amber-light": "rgba(224,169,59,0.12)",
    "--red": "#E5484D",
    "--red-light": "rgba(229,72,77,0.12)",
    "--red-08": "rgba(229,72,77,0.08)",
    "--red-25": "rgba(229,72,77,0.25)",
    "--text-primary": "#F2EFE3",
    "--text-secondary": "#CFCBBA",
    "--text-muted": "#9A9686",
    "--text-hint": "#726E60",
    "--chat-user-bg": "#E4572E",
    "--chat-user-text": "#FFF8F1",
    "--chat-bot-bg": "#1B2017",
    "--chat-bot-text": "#DAD6C7",
    "--header-bg": "rgba(12,14,10,0.88)",
    "--rim": "#3A4132",
    "--focus": "#F0B33C",
    "--shadow-card": "0 1px 0 rgba(255,255,255,0.03), 0 14px 34px rgba(0,0,0,0.35)",
  } : {
    "--bg-primary": "#F4F2E9",
    "--bg-secondary": "#EBE8DC",
    "--bg-card": "#FFFDF7",
    "--bg-card-hover": "#F3EFE3",
    "--bg-input": "#FFFDF7",
    "--border": "#DCD7C6",
    "--border-hover": "#C8C2AE",
    "--orange": "#C6431F",
    "--orange-bright": "#DE5A32",
    "--orange-light": "rgba(198,67,31,0.09)",
    "--orange-08": "rgba(198,67,31,0.06)",
    "--orange-10": "rgba(198,67,31,0.08)",
    "--orange-15": "rgba(198,67,31,0.11)",
    "--orange-20": "rgba(198,67,31,0.14)",
    "--orange-25": "rgba(198,67,31,0.18)",
    "--orange-30": "rgba(198,67,31,0.22)",
    "--orange-40": "rgba(198,67,31,0.32)",
    "--orange-50": "rgba(198,67,31,0.45)",
    "--green": "#2F7D54",
    "--green-light": "rgba(47,125,84,0.10)",
    "--green-08": "rgba(47,125,84,0.07)",
    "--green-25": "rgba(47,125,84,0.22)",
    "--green-32": "rgba(47,125,84,0.28)",
    "--amber": "#A6690F",
    "--amber-light": "rgba(166,105,15,0.10)",
    "--red": "#C0362C",
    "--red-light": "rgba(192,54,44,0.10)",
    "--red-08": "rgba(192,54,44,0.07)",
    "--red-25": "rgba(192,54,44,0.20)",
    "--text-primary": "#171A13",
    "--text-secondary": "#3D4237",
    "--text-muted": "#6B705F",
    "--text-hint": "#8D9280",
    "--chat-user-bg": "#C6431F",
    "--chat-user-text": "#FFF8F1",
    "--chat-bot-bg": "#F0EDE2",
    "--chat-bot-text": "#3D4237",
    "--header-bg": "rgba(244,242,233,0.90)",
    "--rim": "#D3CDBA",
    "--focus": "#9A5B12",
    "--shadow-card": "0 1px 0 rgba(255,255,255,0.7), 0 10px 26px rgba(58,53,38,0.10)",
  }), [dark ]);

  const value = useMemo(() => ({ dark, setDark, toggle: () => setDark((d) => !d), t }), [dark, t]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
