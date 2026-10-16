import { randomUUID } from 'crypto';
import { getPool } from '../db/pool.js';

const MAX_SAVED = 50;

// Minimal green for TDD slice 1: save-anything by name.
// Nullable price/hours, status unverified, never touches catalogue.
export const createSavedPlace = async (userId, { name }) => {
  const pool = await getPool();
  const clean = (name || '').trim().slice(0, 100);
  if (!clean) {
    const err = new Error('name is required');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  const { rows: u } = await pool.query('SELECT 1 FROM users WHERE id = $1', [userId]);
  if (!u.length) {
    const err = new Error('User not found');
    err.code = 'USER_NOT_FOUND';
    throw err;
  }
  const { rows: c } = await pool.query('SELECT count(*)::int AS n FROM saved_places WHERE user_id = $1', [userId]);
  if (c[0].n >= MAX_SAVED) {
    const err = new Error('Saved places list is full (max 50)');
    err.code = 'SAVED_FULL';
    throw err;
  }
  const id = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO saved_places (id, user_id, name, status, price_per_head_ngn, price_source, hours, hours_source)
     VALUES ($1, $2, $3, 'unverified', NULL, 'unknown', NULL, 'unknown') RETURNING *`,
    [id, userId, clean]
  );
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    price_per_head_ngn: r.price_per_head_ngn,
    price_source: r.price_source,
    hours: r.hours,
    hours_source: r.hours_source,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  };
};
