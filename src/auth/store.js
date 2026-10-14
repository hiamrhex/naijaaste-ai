import { randomUUID } from 'crypto';
import { getPool } from '../db/pool.js';
import { env } from '../env.js';

export const isAdminEmail = (email) => {
  const list = (env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes((email || '').toLowerCase().trim());
};

const iso = (v) => (v instanceof Date ? v.toISOString() : v);

const toUser = (row) => {
  if (!row) return null;
  return {
    ...row,
    created_at: iso(row.created_at),
    last_login: row.last_login ? iso(row.last_login) : null,
  };
};

export const createUser = async ({ email, passwordHash, name }) => {
  const pool = await getPool();
  const id = randomUUID();
  const target = email.toLowerCase().trim();
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (id, email, name, password_hash, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, target, name.trim(), passwordHash, isAdminEmail(email) ? 'admin' : 'user']
    );
    const user = toUser(rows[0]);
    return sanitize({ ...user, favorites: [] });
  } catch (err) {
    if (err.code === '23505') {
      const dup = new Error('An account with this email already exists');
      dup.code = 'EMAIL_TAKEN';
      throw dup;
    }
    throw err;
  }
};

export const findUserByEmail = async (email) => {
  const pool = await getPool();
  const target = email.toLowerCase().trim();
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [target]);
  return toUser(rows[0]);
};

export const findUserById = async (id) => {
  const pool = await getPool();
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return toUser(rows[0]);
};

// Creates a passwordless Google user, or links google_sub to an existing
// account with the same email and merges name/picture if missing.
export const upsertGoogleUser = async ({ email, name, picture, sub }) => {
  const pool = await getPool();
  const target = email.toLowerCase().trim();
  const existing = await findUserByEmail(target);
  if (!existing) {
    const id = randomUUID();
    const { rows } = await pool.query(
      `INSERT INTO users (id, email, name, password_hash, google_sub, picture, role, last_login)
       VALUES ($1, $2, $3, NULL, $4, $5, $6, now()) RETURNING *`,
      [id, target, (name || target.split('@')[0]).trim(), sub, picture || null,
        isAdminEmail(email) ? 'admin' : 'user']
    );
    return { user: sanitize({ ...toUser(rows[0]), favorites: [] }), created: true };
  }
  const { rows } = await pool.query(
    `UPDATE users SET last_login = now(), google_sub = $2,
       picture = COALESCE(picture, $3) WHERE id = $1 RETURNING *`,
    [existing.id, sub, picture || null]
  );
  return { user: sanitize({ ...toUser(rows[0]), favorites: await getFavorites(existing.id) }), created: false };
};

export const updateUser = async (id, patch) => {
  const pool = await getPool();
  const sets = [];
  const vals = [id];
  if (patch.last_login !== undefined) {
    sets.push(`last_login = $${vals.length + 1}`);
    vals.push(patch.last_login);
  }
  if (patch.name !== undefined) {
    sets.push(`name = $${vals.length + 1}`);
    vals.push(patch.name);
  }
  if (!sets.length) return sanitize({ ...(await findUserById(id)), favorites: await getFavorites(id) });
  const { rows } = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, vals
  );
  if (!rows[0]) return null;
  return sanitize({ ...toUser(rows[0]), favorites: await getFavorites(id) });
};

export const storeRefreshToken = async (userId, jti, expiresAt) => {
  const pool = await getPool();
  await pool.query(
    'INSERT INTO refresh_tokens (jti, user_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT (jti) DO NOTHING',
    [jti, userId, expiresAt]
  );
  await pool.query('DELETE FROM refresh_tokens WHERE expires_at < now()');
};

export const revokeRefreshToken = async (userId, jti) => {
  const pool = await getPool();
  await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1 AND jti = $2', [userId, jti]);
};

export const hasRefreshToken = async (userId, jti) => {
  const pool = await getPool();
  const { rows } = await pool.query(
    'SELECT 1 FROM refresh_tokens WHERE user_id = $1 AND jti = $2 AND expires_at > now()',
    [userId, jti]
  );
  return rows.length > 0;
};

export const revokeAllRefreshTokens = async (userId) => {
  const pool = await getPool();
  await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
};

export const setPasswordHash = async (userId, passwordHash) => {
  const pool = await getPool();
  const { rows } = await pool.query(
    'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING *',
    [passwordHash, userId]
  );
  if (!rows[0]) return null;
  return sanitize({ ...toUser(rows[0]), favorites: await getFavorites(userId) });
};

const MAX_FAVORITES = 50;

export const getFavorites = async (userId) => {
  const pool = await getPool();
  const { rows } = await pool.query(
    'SELECT restaurant_id FROM favorites WHERE user_id = $1 ORDER BY created_at', [userId]
  );
  return rows.map((r) => r.restaurant_id);
};

export const addFavorite = async (userId, restaurantId) => {
  const pool = await getPool();
  const { rows: u } = await pool.query('SELECT 1 FROM users WHERE id = $1', [userId]);
  if (!u.length) return { ok: false, error: 'USER_NOT_FOUND' };
  const current = await getFavorites(userId);
  if (current.includes(restaurantId)) return { ok: true, favorites: current, added: false };
  if (current.length >= MAX_FAVORITES) return { ok: false, error: 'FAVORITES_FULL' };
  try {
    await pool.query(
      'INSERT INTO favorites (user_id, restaurant_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, restaurantId]
    );
  } catch (err) {
    if (err.code === '23505') return { ok: true, favorites: await getFavorites(userId), added: false };
    throw err;
  }
  return { ok: true, favorites: await getFavorites(userId), added: true };
};

export const removeFavorite = async (userId, restaurantId) => {
  const pool = await getPool();
  const { rows: u } = await pool.query('SELECT 1 FROM users WHERE id = $1', [userId]);
  if (!u.length) return { ok: false, error: 'USER_NOT_FOUND' };
  const { rowCount } = await pool.query(
    'DELETE FROM favorites WHERE user_id = $1 AND restaurant_id = $2', [userId, restaurantId]
  );
  return { ok: true, favorites: await getFavorites(userId), removed: rowCount > 0 };
};

export const sanitize = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  picture: user.picture || null,
  role: user.role || (isAdminEmail(user.email) ? 'admin' : 'user'),
  created_at: user.created_at,
  last_login: user.last_login,
  favorites: user.favorites || [],
});

export const countUsers = async () => {
  const pool = await getPool();
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM users');
  return rows[0].n;
};

export const countFavorites = async () => {
  const pool = await getPool();
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM favorites');
  return rows[0].n;
};

// Full account erasure (Settings → delete account): removes ratings,
// favorites, refresh tokens, sessions, reports, OTPs, then the user row.
// Transactional — all or nothing.
export const deleteUserAccount = async (userId) => {
  const pool = await getPool();
  const { rows: u } = await pool.query('SELECT id, email FROM users WHERE id = $1', [userId]);
  if (!u.length) return { ok: false, error: 'USER_NOT_FOUND' };
  const email = u[0].email;
  await pool.query('BEGIN');
  try {
    await pool.query('DELETE FROM ratings WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM favorites WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM reports WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM otps WHERE email = $1', [email]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await pool.query('ROLLBACK');
    throw err;
  }
};
