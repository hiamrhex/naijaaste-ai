import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');
const USERS_FILE = join(DATA_DIR, 'users.json');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const loadUsers = () => {
  try {
    if (!existsSync(USERS_FILE)) return {};
    return JSON.parse(readFileSync(USERS_FILE, 'utf-8'));
  } catch { return {}; }
};

let store = loadUsers();

const persist = () => {
  try {
    writeFileSync(USERS_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('[auth] User persist failed:', err.message);
  }
};

export const createUser = ({ email, passwordHash, name }) => {
  const id = randomUUID();
  const now = new Date().toISOString();
  store[id] = {
    id,
    email: email.toLowerCase().trim(),
    name: name.trim(),
    password_hash: passwordHash,
    created_at: now,
    last_login: null,
    refresh_tokens: {},
    favorites: [],
  };
  persist();
  return sanitize(store[id]);
};

export const findUserByEmail = (email) => {
  const target = email.toLowerCase().trim();
  return Object.values(store).find(u => u.email === target) || null;
};

export const findUserById = (id) => store[id] || null;

export const updateUser = (id, patch) => {
  if (!store[id]) return null;
  Object.assign(store[id], patch);
  persist();
  return sanitize(store[id]);
};

export const storeRefreshToken = (userId, jti, expiresAt) => {
  if (!store[userId]) return;
  store[userId].refresh_tokens[jti] = { expiresAt };
  // prune expired
  const now = Date.now();
  for (const [k, v] of Object.entries(store[userId].refresh_tokens)) {
    if (new Date(v.expiresAt).getTime() < now) delete store[userId].refresh_tokens[k];
  }
  persist();
};

export const revokeRefreshToken = (userId, jti) => {
  if (!store[userId]?.refresh_tokens) return;
  delete store[userId].refresh_tokens[jti];
  persist();
};

export const hasRefreshToken = (userId, jti) => {
  return !!store[userId]?.refresh_tokens?.[jti];
};

export const revokeAllRefreshTokens = (userId) => {
  if (!store[userId]) return;
  store[userId].refresh_tokens = {};
  persist();
};

export const setPasswordHash = (userId, passwordHash) => {
  if (!store[userId]) return null;
  store[userId].password_hash = passwordHash;
  persist();
  return sanitize(store[userId]);
};

const MAX_FAVORITES = 50;

export const getFavorites = (userId) => store[userId]?.favorites || [];

export const addFavorite = (userId, restaurantId) => {
  if (!store[userId]) return { ok: false, error: 'USER_NOT_FOUND' };
  const favs = store[userId].favorites || (store[userId].favorites = []);
  if (favs.includes(restaurantId)) return { ok: true, favorites: favs, added: false };
  if (favs.length >= MAX_FAVORITES) return { ok: false, error: 'FAVORITES_FULL' };
  favs.push(restaurantId);
  persist();
  return { ok: true, favorites: favs, added: true };
};

export const removeFavorite = (userId, restaurantId) => {
  if (!store[userId]) return { ok: false, error: 'USER_NOT_FOUND' };
  const favs = store[userId].favorites || [];
  const idx = favs.indexOf(restaurantId);
  if (idx === -1) return { ok: true, favorites: favs, removed: false };
  favs.splice(idx, 1);
  persist();
  return { ok: true, favorites: favs, removed: true };
};

export const sanitize = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  created_at: user.created_at,
  last_login: user.last_login,
  favorites: user.favorites || [],
});
