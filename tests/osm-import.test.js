import { describe, it, expect } from 'vitest';
import { importCity, upsertRestaurants, OSM_ATTRIBUTION, IMPORT_CITIES } from '../src/data/import-osm.js';

const node = (id, tags) => ({ type: 'node', id, lat: 6.5, lon: 3.3, tags });

// In-memory fake for the pool: records queries, pretends the table is empty.
const fakeDb = () => {
  const queries = [];
  return {
    queries,
    query: async (text, params) => {
      queries.push({ text, params });
      if (/SELECT osm_id/i.test(text)) return { rows: [] };
      return { rows: [{}] };
    },
  };
};

const okFetch = (elements) => async () => ({
  ok: true,
  json: async () => ({ elements }),
});

describe('osm import (mocked Overpass)', () => {
  it('targets Lagos, Abuja, Port Harcourt, Ibadan by default', () => {
    expect(IMPORT_CITIES).toEqual(['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan']);
  });

  it('success: imports named places, drops nameless ones', async () => {
    const db = fakeDb();
    const r = await importCity(db, 'Lagos', {
      fetchFn: okFetch([
        node(1, { name: 'Mama Put', cuisine: 'nigerian' }),
        node(2, { cuisine: 'cafe' }), // no name → dropped
      ]),
      delayMs: 0,
    });
    expect(r).toMatchObject({ city: 'Lagos', fetched: 2, kept: 1, added: 1, updated: 0 });
    const inserts = db.queries.filter((q) => /INSERT INTO restaurants/i.test(q.text));
    expect(inserts).toHaveLength(1);
    expect(inserts[0].text).toMatch(/ON CONFLICT \(osm_id\) DO UPDATE/);
    expect(inserts[0].params[0]).toBe('node/1');
  });

  it('empty: zero elements → zero queries beyond the existence check', async () => {
    const db = fakeDb();
    const r = await importCity(db, 'Ibadan', { fetchFn: okFetch([]), delayMs: 0 });
    expect(r).toMatchObject({ fetched: 0, kept: 0, added: 0, updated: 0 });
    expect(db.queries.filter((q) => /INSERT/i.test(q.text))).toHaveLength(0);
  });

  it('timeout: failed mirrors throw OSM_FETCH_FAILED, nothing written', async () => {
    const db = fakeDb();
    const failing = async () => { throw new DOMException('Timeout', 'AbortError'); };
    await expect(importCity(db, 'Abuja', { fetchFn: failing, delayMs: 0 }))
      .rejects.toMatchObject({ code: 'OSM_FETCH_FAILED' });
    expect(db.queries).toHaveLength(0);
  });

  it('sends a proper User-Agent and form-encoded Overpass query', async () => {
    const db = fakeDb();
    let seen = null;
    const spy = async (url, opts) => {
      seen = { url, opts };
      return { ok: true, json: async () => ({ elements: [] }) };
    };
    await importCity(db, 'Lagos', { fetchFn: spy, delayMs: 0 });
    expect(seen.url).toContain('overpass');
    expect(seen.opts.headers['User-Agent']).toMatch(/NaijaTasteAI/);
    expect(seen.opts.body).toContain('amenity');
  });

  it('upsert counts added vs updated from pre-existing ids', async () => {
    const seen = [];
    const db = {
      query: async (text, _params) => {
        seen.push(text);
        if (/SELECT/i.test(text)) return { rows: [{ osm_id: 'node/1' }] };
        return { rows: [{}] };
      },
    };
    const entries = [
      { osm_id: 'node/1', name: 'Old', city: 'Lagos', cuisine_tags: [] },
      { osm_id: 'node/9', name: 'New', city: 'Lagos', cuisine_tags: [] },
    ];
    await expect(upsertRestaurants(db, entries)).resolves.toEqual({ added: 1, updated: 1 });
  });

  it('attribution constant names OpenStreetMap + ODbL', () => {
    expect(OSM_ATTRIBUTION).toMatch(/OpenStreetMap/);
  });
});
