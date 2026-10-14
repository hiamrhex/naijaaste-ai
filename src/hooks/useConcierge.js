import { useState, useEffect, useCallback } from 'react';
import { API, HERO_PHRASES, STAGES } from '../constants/index.js';
import { authFetch, getFavorites, addFavorite, removeFavorite } from '../lib/auth.js';

const HISTORY_KEY = 'nt.history.v1';
const HISTORY_CAP = 30;
const WELCOME = "Welcome! I'm NaijaTaste AI — your personal guide to the best restaurants across Nigeria. Tell me about yourself — your city, your budget, what you're craving — and I'll find the perfect spot for you.";

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
  const [messages, setMessages] = useState([{ role: 'assistant', content: WELCOME }]);
  const [sessionId, setSessionId] = useState(null);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('gather');
  const [persona, setPersona] = useState(null);
  const [recs, setRecs] = useState(null);
  const [meta, setMeta] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [review, setReview] = useState(null);
  const [reviewRestaurant, setReviewRestaurant] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const [thinkOpen, setThinkOpen] = useState(true);
  const [resultsOpen, setResultsOpen] = useState(true);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const [favorites, setFavorites] = useState([]);
  const [nearby, setNearby] = useState(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState('');
  const [showNearby, setShowNearby] = useState(false);
  const [geoCache, setGeoCache] = useState({});

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
    fetch(`${API}/restaurants/geo?ids=${encodeURIComponent(uncached.join(','))}`)
      .then((res) => (res.ok ? res.json() : null))
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
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data?.error?.message || 'Nearby lookup failed');
          setNearby(data);
        } catch (err) {
          setNearbyError(err.message || 'Could not find spots near you.');
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
    try {
      const res = await authFetch('/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: txt, session_id: sessionId || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error?.message || 'Agent request failed');
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
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: err.message || 'Connection issue — please try again.',
        error: true,
      }]);
    } finally {
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
      const data = await res.json();
      setReview(data);
      setShowReview(true);
    } catch {
      /* silent fail */
    } finally {
      setReviewLoading(false);
    }
  }, [persona, reviewLoading]);

  const reset = useCallback(() => {
    setMessages([{ role: 'assistant', content: WELCOME }]);
    setSessionId(null);
    setStage('gather');
    setPersona(null);
    setRecs(null);
    setMeta(null);
    setInputVal('');
    setShowQuickPrompts(true);
    setResultsOpen(true);
  }, []);

  const stageIdx = STAGES.indexOf(stage);

  return {
    heroIdx, heroVisible, messages, sessionId, inputVal, setInputVal,
    loading, stage, stageIdx, persona, recs, meta,
    reviewLoading, review, reviewRestaurant, showReview, setShowReview,
    thinkOpen, setThinkOpen, resultsOpen, setResultsOpen,
    showQuickPrompts, favorites, nearby, nearbyLoading, nearbyError,
    showNearby, setShowNearby, geoCache,
    toggleFavorite, findNearby, sendMsg, generateReview, reset,
  };
}

export { readHistory, HISTORY_KEY };
