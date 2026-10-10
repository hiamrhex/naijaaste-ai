import { API } from '../constants/index.js';

const KEY = 'naijataste.auth';

const loadStored = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

let current = typeof localStorage !== 'undefined' ? loadStored() : null;

export const getAuth = () => current;

export const setAuth = (auth) => {
  current = auth;
  try { localStorage.setItem(KEY, JSON.stringify(auth)); } catch { /* private mode */ }
};

export const dropAuth = () => {
  current = null;
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
};

const parseError = async (res) => {
  try {
    const data = await res.json();
    return data?.error?.message || data?.error || 'Request failed';
  } catch { return 'Request failed'; }
};

export const signup = async ({ name, email, password }) => {
  const res = await fetch(`${API}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  setAuth({ user: data.user, accessToken: data.accessToken });
  return data.user;
};

export const signin = async ({ email, password }) => {
  const res = await fetch(`${API}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  setAuth({ user: data.user, accessToken: data.accessToken });
  return data.user;
};

export const signout = async () => {
  try {
    await fetch(`${API}/auth/signout`, { method: 'POST', credentials: 'include' });
  } finally {
    dropAuth();
  }
};

export const tryRefresh = async () => {
  if (!current) return false;
  try {
    const res = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = await res.json();
    setAuth({ user: data.user, accessToken: data.accessToken });
    return true;
  } catch { return false; }
};

// Fetch wrapper: attaches Bearer token, auto-refreshes once on 401.
export const authFetch = async (path, options = {}) => {
  if (!current) throw new Error('Not authenticated');
  const doFetch = () => fetch(`${API}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${current.accessToken}`,
    },
  });

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
