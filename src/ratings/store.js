import { randomUUID } from 'crypto';
import { getPool } from '../db/pool.js';

// Check-in ratings (C): 1–5 stars + optional note, stored server-side so
// they can feed recommendations later. Postgres-backed (pg-mem in tests).
const iso = (v) => (v instanceof Date ? v.toISOString() : v);

const toRating = (row) => {
  if (!row) return null;
  return { ...row, at: iso(row.at) };
};

export const createRating = async ({ userId, restaurantId, stars, note, context }) => {
  const pool = await getPool();
  const { rows } = await pool.query(
    `INSERT INTO ratings (id, user_id, restaurant_id, stars, note, context)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [randomUUID(), userId, restaurantId, stars, note || null, context || 'saved']
  );
  return toRating(rows[0]);
};

export const listRatingsByUser = async (userId) => {
  const pool = await getPool();
  const { rows } = await pool.query(
    'SELECT * FROM ratings WHERE user_id = $1 ORDER BY at DESC', [userId]
  );
  return rows.map(toRating);
};

export const listAllRatings = async () => {
  const pool = await getPool();
  const { rows } = await pool.query('SELECT * FROM ratings ORDER BY at DESC');
  return rows.map(toRating);
};

export const countRatings = async () => {
  const pool = await getPool();
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM ratings');
  return rows[0].n;
};
