import { describe, it, expect, vi, beforeEach } from 'vitest';

// addFavorite used to count the list and then insert with no lock, so two adds
// at 49 both read 49 and both inserted (observed: 51 rows). The fix locks the
// user row before counting. pg-mem ignores FOR UPDATE, so this test asserts the
// statement order deterministically instead of relying on the engine.

const state = vi.hoisted(() => ({ queries: [], favorites: [], userExists: true }));

vi.mock('../src/db/pool.js', () => ({
  getPool: async () => ({ query: async () => ({ rows: [] }) }),
  withTransaction: async (fn) =>
    fn({
      query: async (text, params) => {
        const sql = text.replace(/\s+/g, ' ').trim();
        state.queries.push(sql);
        if (/FROM users WHERE id = \$1 FOR UPDATE/.test(sql)) {
          return { rows: state.userExists ? [{ id: 'u1' }] : [] };
        }
        if (/FROM favorites/.test(sql)) {
          return { rows: state.favorites.map((id) => ({ restaurant_id: id })) };
        }
        if (/INSERT INTO favorites/.test(sql)) {
          state.favorites.push(params[1]);
          return { rows: [] };
        }
        return { rows: [] };
      },
    }),
}));

const { addFavorite } = await import('../src/auth/store.js');

beforeEach(() => {
  state.queries.length = 0;
  state.favorites = [];
  state.userExists = true;
});

describe('addFavorite', () => {
  it('locks the user row before counting the list', async () => {
    state.favorites = ['r001'];

    const result = await addFavorite('u1', 'r002');

    expect(result).toEqual({ ok: true, favorites: ['r001', 'r002'], added: true });
    expect(state.queries[0]).toMatch(/FOR UPDATE/);
    const lockAt = state.queries.findIndex((q) => /FOR UPDATE/.test(q));
    const countAt = state.queries.findIndex((q) => /FROM favorites/.test(q));
    expect(lockAt).toBeGreaterThanOrEqual(0);
    expect(lockAt).toBeLessThan(countAt);
  });

  it('returns FAVORITES_FULL without inserting at 50', async () => {
    state.favorites = Array.from({ length: 50 }, (_, i) => `r${String(i).padStart(3, '0')}`);

    const result = await addFavorite('u1', 'r999');

    expect(result).toEqual({ ok: false, error: 'FAVORITES_FULL' });
    expect(state.queries.some((q) => /INSERT INTO favorites/.test(q))).toBe(false);
  });

  it('is idempotent for an existing favourite', async () => {
    state.favorites = ['r001'];

    const result = await addFavorite('u1', 'r001');

    expect(result).toEqual({ ok: true, favorites: ['r001'], added: false });
    expect(state.queries.some((q) => /INSERT INTO favorites/.test(q))).toBe(false);
  });

  it('reports a missing user without counting', async () => {
    state.userExists = false;

    const result = await addFavorite('gone', 'r001');

    expect(result).toEqual({ ok: false, error: 'USER_NOT_FOUND' });
    expect(state.queries.some((q) => /FROM favorites/.test(q))).toBe(false);
  });
});
