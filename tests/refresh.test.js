import { describe, it, expect } from 'vitest';
import { normalizeOsmElement, mergeCatalogue, markStale, CITY_BBOX } from '../src/data/refresh.js';

const NOW = '2026-10-11T18:00:00.000Z';

const curated = () => ([
  { restaurant_id: 'r001', name: 'Buka Hut Lagos', city: 'Lagos' },
]);

describe('live catalogue refresh (data pipeline)', () => {
  it('covers all 8 catalogue cities', () => {
    expect(Object.keys(CITY_BBOX).sort()).toEqual(
      ['Abuja', 'Benin City', 'Calabar', 'Enugu', 'Ibadan', 'Kano', 'Lagos', 'Port Harcourt'].sort()
    );
  });

  it('normalize: drops nameless elements, never invents ratings/prices', () => {
    expect(normalizeOsmElement({ type: 'node', id: 1, tags: {} }, 'Lagos', NOW)).toBeNull();
    const r = normalizeOsmElement(
      { type: 'node', id: 9, lat: 6.5, lon: 3.3, tags: { name: 'Mama Put', cuisine: 'nigerian;african' } },
      'Lagos', NOW
    );
    expect(r.restaurant_id).toBe('osm-n9');
    expect(r.average_rating).toBeNull();
    expect(r.price_range_naira).toBeNull();
    expect(r.source).toBe('osm');
    expect(r.verified).toBe(false);
    expect(r.cuisine_tags).toEqual(['nigerian', 'african']);
  });

  it('merge: backfills provenance, dedupes by name, adds genuinely new places', () => {
    const cat = curated();
    const fresh = { ...normalizeOsmElement({ type: 'node', id: 1, tags: { name: 'Buka Hut (Lagos)' } }, 'Lagos', NOW) };
    const novel = { ...normalizeOsmElement({ type: 'node', id: 2, tags: { name: 'New Spot XYZ' } }, 'Lagos', NOW) };
    const { catalogue, added, matched } = mergeCatalogue(cat, [fresh, novel], NOW);
    expect(matched).toBe(1);
    expect(added).toBe(1);
    expect(catalogue).toHaveLength(2);
    expect(catalogue[0].source).toBe('curated');
    expect(catalogue[0].osm_id).toBe('node/1');
    expect(catalogue[1].restaurant_id).toBe('osm-n2');
  });

  it('merge: re-seeing an osm_id only bumps last_seen (idempotent re-runs)', () => {
    const cat = curated();
    const f = normalizeOsmElement({ type: 'node', id: 2, tags: { name: 'New Spot XYZ' } }, 'Lagos', NOW);
    mergeCatalogue(cat, [f], NOW);
    const again = mergeCatalogue(cat, [{ ...f }], NOW);
    expect(again.added).toBe(0);
    expect(again.matched).toBe(1);
    expect(cat).toHaveLength(2);
  });

  it('markStale: flags entries unseen beyond the threshold', () => {
    const cat = [
      { restaurant_id: 'a', last_seen: '2026-10-01T00:00:00.000Z' },
      { restaurant_id: 'b', last_seen: '2026-01-01T00:00:00.000Z' },
    ];
    const stale = markStale(cat, Date.parse(NOW), 90);
    expect(stale).toBe(1);
    expect(cat[0].stale).toBe(false);
    expect(cat[1].stale).toBe(true);
  });
});
