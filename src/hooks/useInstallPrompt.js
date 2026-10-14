import { useState, useEffect, useCallback } from 'react';

const DISMISS_KEY = 'nt.install.dismissed.v1';
const DISMISS_DAYS = 14;

const isStandalone = () =>
  (typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(display-mode: standalone)').matches) ||
  (typeof navigator !== 'undefined' && navigator.standalone === true);

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent || '') ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1));

const dismissedRecently = () => {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - at < DISMISS_DAYS * 24 * 3600 * 1000;
  } catch { return false; }
};

/* Install-prompt state machine (B rules):
   - captures beforeinstallprompt so the browser default never shows,
   - shows our sheet only after a good moment (first save / finished plan),
   - never on first load, hidden when installed, 14-day dismissal memory,
   - iPhone (no install event) gets the Share → Add to Home Screen guide. */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [moment, setMoment] = useState(false);
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(isStandalone());
  const ios = isIOS();

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onMoment = () => setMoment(true);
    globalThis.addEventListener('beforeinstallprompt', onPrompt);
    globalThis.addEventListener('nt:good-moment', onMoment);
    return () => {
      globalThis.removeEventListener('beforeinstallprompt', onPrompt);
      globalThis.removeEventListener('nt:good-moment', onMoment);
    };
  }, []);

  useEffect(() => {
    if (done || dismissedRecently() || !moment) return;
    if (!ios && !deferred) return; // Android/desktop: need the real event
    setVisible(true);
  }, [done, moment, deferred, ios]);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* noop */ }
    setVisible(false);
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* noop */ }
    setDeferred(null);
    setDone(true);
    setVisible(false);
  }, [deferred]);

  return { visible, ios, installed: done, install, dismiss };
}
