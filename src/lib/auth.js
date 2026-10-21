import { API } from '../constants/index.js';
import { ApiClientError, readJson } from './api.js';

const KEY = 'naijataste.auth';

const loadStored = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

let current = typeof localStorage !== 'undefined' ? loadStored() : null;
// The access token lives in memory only — localStorage keeps { user } so a
// stolen/injected script cannot lift a long-lived bearer (item 4). The
// httpOnly refresh cookie rehydrates it via tryRefresh().
if (current && typeof current === 'object' && 'accessToken' in current) {
  delete current.accessToken;
}

export const getAuth = () => current;

export const setAuth = (auth) => {
  current = auth;
  try { localStorage.setItem(KEY, JSON.stringify({ user: auth?.user ?? null })); } catch { /* private mode */ }
};

export const dropAuth = () => {
  current = null;
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
};

// Last X-Request-Id seen from the API — auto-attached to feedback reports (D).
let lastRequestId = null;
export const getLastRequestId = () => lastRequestId;
const track = (res) => {
  try {
    const v = res.headers?.get?.('x-request-id');
    if (v) lastRequestId = v;
  } catch { /* non-Response in tests */ }
  return res;
};

export const signup = async ({ name, email, password }) => {
  const res = track(await fetch(`${API}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  }));
  const data = await readJson(res, { fallbackMessage: 'Could not create your account. Please try again.' });
  setAuth({ user: data.user, accessToken: data.accessToken });
  return data.user;
};

export const signin = async ({ email, password }) => {
  const res = track(await fetch(`${API}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }));
  const data = await readJson(res, { fallbackMessage: 'Could not sign you in. Please try again.' });
  setAuth({ user: data.user, accessToken: data.accessToken });
  return data.user;
};

export const googleSignIn = async (credential) => {
  const res = track(await fetch(`${API}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  }));
  const data = await readJson(res, { fallbackMessage: 'Google sign-in failed. Please try again.' });
  setAuth({ user: data.user, accessToken: data.accessToken });
  return data.user;
};

export const signout = async () => {
  try {
    track(await fetch(`${API}/auth/signout`, { method: 'POST', credentials: 'include' }));
  } finally {
    dropAuth();
  }
};

export const deleteAccount = async () => {
  const res = await authFetch('/auth/me', { method: 'DELETE' });
  await readJson(res, { fallbackMessage: 'Could not delete your account. Please try again.' });
  dropAuth();
  try {
    for (const k of ['nt.history.v1', 'nt.plans.v1', 'nt.theme.v1', 'nt.lang.v1']) localStorage.removeItem(k);
  } catch { /* private mode */ }
};

// Returns { message, dev_otp? } — dev_otp only present outside production.
export const forgotPassword = async ({ email }) => {
  const res = track(await fetch(`${API}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }));
  return readJson(res, { fallbackMessage: 'Could not send the reset code. Please try again.' });
};

export const resetPassword = async ({ email, otp, newPassword }) => {
  const res = track(await fetch(`${API}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp, new_password: newPassword }),
  }));
  return readJson(res, { fallbackMessage: 'Could not reset your password. Please try again.' });
};

export const getFavorites = async () => {
  const res = await authFetch('/auth/favorites');
  const data = await readJson(res, { fallbackMessage: 'Could not load favorites.' });
  return data.favorites || [];
};

export const addFavorite = async (restaurantId) => {
  const res = await authFetch('/auth/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurant_id: restaurantId }),
  });
  const data = await readJson(res, { fallbackMessage: 'Could not save favorite.' });
  return data.favorites || [];
};

export const removeFavorite = async (restaurantId) => {
  const res = await authFetch(`/auth/favorites/${encodeURIComponent(restaurantId)}`, {
    method: 'DELETE',
  });
  const data = await readJson(res, { fallbackMessage: 'Could not remove favorite.' });
  return data.favorites || [];
};

export const getSavedPlaces = async () => {
  const res = await authFetch('/auth/saved-places');
  const data = await readJson(res, { fallbackMessage: 'Could not load saved spots.' });
  return data.places || [];
};

export const addSavedPlace = async (name) => {
  const res = await authFetch('/auth/saved-places', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const data = await readJson(res, { fallbackMessage: 'Could not save spot.' });
  return data.place;
};

export const deleteSavedPlace = async (id) => {
  const res = await authFetch(`/auth/saved-places/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (res.status === 404) {
    // Consume the body through the safe reader, then keep the honest copy.
    await readJson(res, { fallbackMessage: 'That spot is already gone' }).catch(() => {});
    throw new Error('That spot is already gone');
  }
  await readJson(res, { fallbackMessage: 'Could not delete spot.' });
  return true;
};

export const postRating = async ({ restaurant_id, stars, note, context }) => {
  const res = await authFetch('/ratings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurant_id, stars, note, context }),
  });
  const data = await readJson(res, { fallbackMessage: 'Could not save rating.' });
  return data.data;
};

export const postReport = async ({ type, message, screen, device, app_version, restaurant_id, screenshot }) => {
  const res = await authFetch('/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, message, screen, device, app_version, restaurant_id, screenshot }),
  });
  const data = await readJson(res, { fallbackMessage: 'Could not send report.' });
  return data.data;
};

export const tryRefresh = async () => {
  if (!current) return false;
  try {
    const res = track(await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    }));
    if (!res.ok) return false;
    const data = await readJson(res, { fallbackMessage: 'Could not restore your session.' });
    setAuth({ user: data.user, accessToken: data.accessToken });
    return true;
  } catch { return false; }
};

// Fetch wrapper: attaches Bearer token, auto-refreshes once on 401 — and
// refreshes proactively when the in-memory token is absent (fresh page load:
// user is known from storage, token rehydrated from the httpOnly cookie).
export const authFetch = async (path, options = {}) => {
  if (!current) throw new Error('Not authenticated');
  if (!current.accessToken) {
    const refreshed = await tryRefresh();
    if (!refreshed) {
      dropAuth();
      globalThis.dispatchEvent(new Event('auth:expired'));
      throw new Error('Session expired — please sign in again');
    }
  }
  const doFetch = async () => {
    try {
      return track(await fetch(`${API}${path}`, {
        ...options,
        credentials: 'include',
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${current.accessToken}`,
        },
      }));
    } catch (cause) {
      if (cause?.name === 'AbortError') throw cause;
      throw new ApiClientError({
        message: 'We could not reach the server. Check your connection and try again.',
        cause,
      });
    }
  };

  let res = await doFetch();
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doFetch();
    } else {
      dropAuth();
      globalThis.dispatchEvent(new Event('auth:expired'));
      throw new Error('Session expired — please sign in again');
    }
  }
  return res;
};
