import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { API, HERO_PHRASES, STAGES } from '../constants/index.js';
import { recordCheckInEvent } from './useCheckIn.js';
import { authFetch, getFavorites, addFavorite, removeFavorite } from '../lib/auth.js';
import { apiFetchJson, errorMessage, readJson } from '../lib/api.js';
import { chatStore } from '../app/chat-store.js';

const HISTORY_KEY = 'nt.history.v1';
const HISTORY_CAP = 30;

const readHistory = () => {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
};

const logHistory = (entry) => {
  try {
    const next = [entry, ...readHistory()].slice(0, HISTORY_CAP);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch { /* private mode */ }
};

/* All chat/concierge state + actions, shared by Home today and History/Plan later.
   Refs are created by the calling screen and passed in, so this hook's
   return value stays ref-free (clean render reads, no ref access in JSX). */
export function useConcierge({ chatEndRef }) {
  const [heroIdx, setHeroIdx] = useState(0);
  const [heroVisible, setHeroVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [review, setReview] = useState(null);
  const [reviewRestaurant, setReviewRestaurant] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const [thinkOpen, setThinkOpen] = useState(true);
  const [resultsOpen, setResultsOpen] = useState(true);
  const [favorites, setFavorites] = useState([]);
  const [nearby, setNearby] = useState(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState('');
  const [showNearby, setShowNearby] = useState(false);
  const [geoCache, setGeoCache] = useState({});
  const [inputVal, setInputVal] = useState('');

  // The conversation itself lives OUTSIDE React (see src/app/chat-store.js):
  // it survives a tab switch and a reload, and it is one continuous history.
  const stored = useSyncExternalStore(chatStore.subscribe, chatStore.get, chatStore.get);
  const { messages, sessionId, persona, recs, meta, stage, showQuickPrompts } = stored;

  const setMessages = useCallback((update) => {
    chatStore.set((prev) => ({
      messages: typeof update === 'function' ? update(prev.messages) : update,
    }));
  }, []);
  const setSessionId = useCallback((value) => {
    chatStore.set((prev) => ({
      sessionId: typeof value === 'function' ? value(prev.sessionId) : value,
    }));
  }, []);
  const setPersona = useCallback((value) => {
    chatStore.set((prev) => ({ persona: typeof value === 'function' ? value(prev.persona) : value }));
  }, []);
  const setRecs = useCallback((value) => {
    chatStore.set((prev) => ({ recs: typeof value === 'function' ? value(prev.recs) : value }));
  }, []);
  const setMeta = useCallback((value) => {
    chatStore.set((prev) => ({ meta: typeof value === 'function' ? value(prev.meta) : value }));
  }, []);
  const setStage = useCallback((value) => {
    chatStore.set((prev) => ({ stage: typeof value === 'function' ? value(prev.stage) : value }));
  }, []);
  const setShowQuickPrompts = useCallback((value) => {
    chatStore.set((prev) => ({
      showQuickPrompts: typeof value === 'function' ? value(prev.showQuickPrompts) : value,
    }));
  }, []);

  useEffect(() => {
    getFavorites().then(setFavorites).catch(() => {});
  }, []);

  useEffect(() => {
    if (!recs?.length) return;
    const ids = recs.map((r) => r.restaurant_id).filter(Boolean);
    if (ids.length === 0) return;
    const uncached = ids.filter((id) => !geoCache[id]);
    if (uncached.length === 0) return;
    let cancelled = false;
    apiFetchJson(`${API}/restaurants/geo?ids=${encodeURIComponent(uncached.join(','))}`)
      .then((data) => {
        if (!cancelled && data?.geo) setGeoCache((prev) => ({ ...prev, ...data.geo }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [recs, geoCache]);

  const toggleFavorite = useCallback(async (restaurantId) => {
    if (!restaurantId) return;
    const isFav = favorites.includes(restaurantId);
    setFavorites((prev) => (isFav ? prev.filter((id) => id !== restaurantId) : [...prev, restaurantId]));
    try {
      const next = isFav ? await removeFavorite(restaurantId) : await addFavorite(restaurantId);
      setFavorites(next);
      if (!isFav) {
        try { globalThis.dispatchEvent(new Event('nt:good-moment')); } catch { /* noop */ }
        recordCheckInEvent(restaurantId, 'saved');
      }
    } catch {
      setFavorites((prev) => (isFav ? [...prev, restaurantId] : prev.filter((id) => id !== restaurantId)));
    }
  }, [favorites]);

  const findNearby = useCallback(() => {
    if (nearbyLoading) return;
    setShowNearby(true);
    setNearbyError('');
    setNearbyLoading(true);
    if (!navigator.geolocation) {
      setNearbyLoading(false);
      setNearbyError('Geolocation is not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`${API}/nearby?lat=${latitude}&lng=${longitude}&limit=8&radius_km=25`);
          const data = await readJson(res, { fallbackMessage: 'Could not find spots near you.' });
          if (!data.success) throw new Error('Could not find spots near you.');
          setNearby(data);
        } catch (err) {
          setNearbyError(errorMessage(err, 'Could not find spots near you.'));
        } finally {
          setNearbyLoading(false);
        }
      },
      (err) => {
        setNearbyLoading(false);
        setNearbyError(
          err.code === 1
            ? 'Location permission denied — enable it to find spots near you.'
            : 'Could not get your location — try again.'
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [nearbyLoading]);

  /* Hero phrase rotation */
  useEffect(() => {
    const interval = setInterval(() => {
      setHeroVisible(false);
      setTimeout(() => {
        setHeroIdx((i) => (i + 1) % HERO_PHRASES.length);
        setHeroVisible(true);
      }, 400);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  /* Auto-scroll */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMsg = useCallback(async (text) => {
    const txt = (text || inputVal).trim();
    if (!txt || loading) return;
    setInputVal('');
    setShowQuickPrompts(false);
    setMessages((prev) => [...prev, { role: 'user', content: txt }]);
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await authFetch('/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: txt, session_id: sessionId || undefined }),
        signal: controller.signal,
      });
      const data = await readJson(res, { fallbackMessage: 'The AI chef could not answer. Please try again.' });
      if (!data.success) {
        throw new Error('The AI chef could not answer. Please try again.');
      }
      if (data.session_id) setSessionId(data.session_id);
      if (data.stage) setStage(data.stage);
      if (data.extracted_persona) setPersona(data.extracted_persona);
      const recList = data.recommendations?.recommendations || null;
      if (recList) {
        setRecs(recList);
        setResultsOpen(true);
      }
      if (data.meta) setMeta(data.meta);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: data.message || 'No response received.',
        trace: data.trace || null,
      }]);
      logHistory({
        session_id: data.session_id || sessionId,
        preview: txt.slice(0, 60),
        at: new Date().toISOString(),
        recs: recList ? recList.length : 0,
      });
      try { globalThis.dispatchEvent(new Event('nt:chat-done')); } catch { /* noop */ }
    } catch (err) {
      if (err?.name === 'AbortError') {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: 'Stopped — ask me anything else.',
        }]);
      } else {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: errorMessage(err, 'Connection issue — please try again.'),
          error: true,
          requestId: err?.requestId || null,
          retryText: txt,
        }]);
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }, [inputVal, loading, sessionId]);

  const generateReview = useCallback(async (restaurant) => {
    if (!persona || reviewLoading) return;
    setReviewLoading(true);
    setReviewRestaurant(restaurant);
    try {
      const res = await fetch(`${API}/generate-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona, restaurant }),
      });
      const data = await readJson(res, { fallbackMessage: 'Could not generate a review.' });
      setReview(data);
      setShowReview(true);
    } catch {
      /* silent fail */
    } finally {
      setReviewLoading(false);
    }
  }, [persona, reviewLoading]);

  const reset = useCallback(() => {
    // Start a genuinely new conversation: the server session is dropped too,
    // so the next message opens a fresh one.
    chatStore.reset();
    setInputVal('');
    setResultsOpen(true);
  }, []);

  const stageIdx = STAGES.indexOf(stage);

  const abortRef = useRef(null);
  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    heroIdx, heroVisible, messages, sessionId, inputVal, setInputVal,
    loading, stage, stageIdx, persona, recs, meta,
    reviewLoading, review, reviewRestaurant, showReview, setShowReview,
    thinkOpen, setThinkOpen, resultsOpen, setResultsOpen,
    showQuickPrompts, favorites, nearby, nearbyLoading, nearbyError,
    showNearby, setShowNearby, geoCache,
    toggleFavorite, findNearby, sendMsg, stop, generateReview, reset,
  };
}

export { readHistory, HISTORY_KEY };
