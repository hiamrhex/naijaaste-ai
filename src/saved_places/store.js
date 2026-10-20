import { randomUUID } from 'crypto';
import { getPool } from '../db/pool.js';

// Minimal green for TDD slice 1: save-anything by name.
// Nullable price/hours, status unverified, never touches catalogue.
//
// The 50-place cap is enforced inside a single transaction that locks the
// user's row (SELECT ... FOR UPDATE) before counting and inserting: two
// concurrent creates for the same user serialize, so the count each insert
// observes is the committed truth — the cap holds even under parallel bursts.

export const MAX_SAVED = 50;

// Per-user in-process lock around the cap check.
//
// Postgres serializes the check with SELECT ... FOR UPDATE on the user's row,
// so two concurrent creates for the same user queue up and each insert judges
// the cap against settled state. pg-mem - the driver the test suite runs on -
// parses FOR UPDATE but does not honour row locks, so without this the cap was
// a no-op there and a parallel burst could push a user past 50.
//
// The lock serialises requests inside one process (which is the whole world
// for pg-mem, and a useful short-circuit on Postgres); the row lock remains
// the guard that holds across instances.
const capLocks = new Map();

const withCapLock = async (userId, fn) => {
  const wait = capLocks.get(userId) || Promise.resolve();
  let unlock;
  const held = new Promise((resolve) => { unlock = resolve; });
  capLocks.set(userId, held);
  await wait;
  try {
    return await fn();
  } finally {
    unlock();
    if (capLocks.get(userId) === held) capLocks.delete(userId);
  }
};

export const listSavedPlaces = async (userId) => {
  const pool = await getPool();
  const { rows } = await pool.query(
    'SELECT id, name, area, price_per_head_ngn, price_source, hours, hours_source, status, created_at FROM saved_places WHERE user_id = $1 ORDER BY created_at',
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    area: r.area,
    price_per_head_ngn: r.price_per_head_ngn,
    price_source: r.price_source,
    hours: r.hours,
    hours_source: r.hours_source,
    status: r.status,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  }));
};

export const deleteSavedPlace = async (userId, id) => {
  const pool = await getPool();
  // Ownership is in the WHERE clause: another user's id (or a made-up id)
  // deletes zero rows → the route maps that to 404. Full stop.
  const { rowCount } = await pool.query('DELETE FROM saved_places WHERE id = $1 AND user_id = $2', [
    id,
    userId,
  ]);
  return rowCount > 0;
};

export const createSavedPlace = async (userId, { name }) => {
  const clean = (name || '').trim().slice(0, 100);
  if (!clean) {
    const err = new Error('name is required');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  return withCapLock(userId, async () => {
    const pool = await getPool();
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      // Lock the user's row: concurrent creates for the same user queue up here
      // (real Postgres), so every insert judges the cap against settled state.
      const { rows: u } = await db.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
      if (!u.length) {
        await db.query('ROLLBACK');
        const err = new Error('User not found');
        err.code = 'USER_NOT_FOUND';
        throw err;
      }
      const { rows: c } = await db.query(
        'SELECT count(*)::int AS n FROM saved_places WHERE user_id = $1',
        [userId]
      );
      if (c[0].n >= MAX_SAVED) {
        await db.query('ROLLBACK');
        const err = new Error('Saved places list is full (max 50)');
        err.code = 'SAVED_FULL';
        throw err;
      }
      const id = randomUUID();
      const { rows } = await db.query(
        `INSERT INTO saved_places (id, user_id, name, status, price_per_head_ngn, price_source, hours, hours_source)
         VALUES ($1, $2, $3, 'unverified', NULL, 'unknown', NULL, 'unknown') RETURNING *`,
        [id, userId, clean]
      );
      await db.query('COMMIT');
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
    } catch (err) {
      try {
        await db.query('ROLLBACK');
      } catch { /* client already released on rollback of a closed txn */ }
      throw err;
    } finally {
      db.release();
    }
  });
};
