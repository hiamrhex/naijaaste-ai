import { useState, useEffect, useCallback } from 'react';
import { postRating } from '../lib/auth.js';

// Check-in engine (C): prompts "Did you go? How was it?" the day after a
// save/plan/share — max once per session, never on launch or after errors,
// skipped when answered or recently dismissed.
const QUEUE_KEY = 'nt.checkin.queue.v1';
const ANSWERED_KEY = 'nt.checkin.answered.v1';
const DISMISS_KEY = 'nt.checkin.dismissed.v1';
const DAY_MS = 24 * 3600 * 1000;
const SNOOZE_MS = 7 * DAY_MS;

const readJson = (k, fb) => {
  try {
    const v = JSON.parse(localStorage.getItem(k) || 'null');
    return v ?? fb;
  } catch { return fb; }
};

const writeJson = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* noop */ }
};

export const recordCheckInEvent = (restaurant_id, context) => {
  if (!restaurant_id) return;
  const q = readJson(QUEUE_KEY, []);
  if (q.some((e) => e.restaurant_id === restaurant_id)) return;
  q.push({ restaurant_id, context, at: Date.now() });
  writeJson(QUEUE_KEY, q.slice(-20));
};

const sessionShown = () => {
  try { return sessionStorage.getItem('nt.checkin.shown') === '1'; } catch { return true; }
};
const markSessionShown = () => {
  try { sessionStorage.setItem('nt.checkin.shown', '1'); } catch { /* noop */ }
};

export function useCheckIn() {
  const [candidate, setCandidate] = useState(null);

  const refresh = useCallback(() => {
    if (sessionShown()) return;
    const dismissedAt = Number(readJson(DISMISS_KEY, 0));
    if (Date.now() - dismissedAt < SNOOZE_MS) return;
    const answered = new Set(readJson(ANSWERED_KEY, []));
    const due = readJson(QUEUE_KEY, []).find(
      (e) => e && e.restaurant_id && !answered.has(e.restaurant_id) && Date.now() - e.at >= DAY_MS
    );
    if (due) {
      markSessionShown();
      setCandidate(due);
    }
  }, []);

  useEffect(() => {
    const onDone = () => refresh();
    globalThis.addEventListener('nt:chat-done', onDone);
    globalThis.addEventListener('nt:plan-done', onDone);
    return () => {
      globalThis.removeEventListener('nt:chat-done', onDone);
      globalThis.removeEventListener('nt:plan-done', onDone);
    };
  }, [refresh]);

  const dismiss = useCallback(() => {
    writeJson(DISMISS_KEY, Date.now());
    setCandidate(null);
  }, []);

  const answer = useCallback(async ({ stars, note }) => {
    if (!candidate) return { low: false };
    await postRating({
      restaurant_id: candidate.restaurant_id,
      stars,
      note: note || undefined,
      context: candidate.context,
    });
    const answered = new Set(readJson(ANSWERED_KEY, []));
    answered.add(candidate.restaurant_id);
    writeJson(ANSWERED_KEY, [...answered]);
    writeJson(QUEUE_KEY, readJson(QUEUE_KEY, []).filter((e) => e.restaurant_id !== candidate.restaurant_id));
    const low = stars <= 2;
    if (!low) setCandidate(null);
    return { low };
  }, [candidate]);

  const closeAfterWrong = useCallback(() => setCandidate(null), []);

  return { candidate, dismiss, answer, closeAfterWrong };
}
