import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlacesCache } from '../src/services/places-cache.js';
import { googlePlaceIdSchema, restaurantSchema } from '../src/schemas/index.js';

describe('places cache (policy: ephemeral, memory-only)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns stored display fields within TTL', () => {
    const c = new PlacesCache({ ttlMs: 30 * 60 * 1000 });
    c.set('ChIJ123', { name: 'Buka Hut', rating: 4.3, openNow: true });
    expect(c.get('ChIJ123')).toMatchObject({ placeId: 'ChIJ123', name: 'Buka Hut', rating: 4.3 });
  });

  it('expires entries after TTL (no long-lived Google content)', () => {
    const c = new PlacesCache({ ttlMs: 1000 });
    c.set('ChIJ123', { name: 'Buka Hut' });
    vi.advanceTimersByTime(1001);
    expect(c.get('ChIJ123')).toBeNull();
  });

  it('strips non-whitelisted fields (photos/reviews never cached)', () => {
    const c = new PlacesCache();
    const clean = c.set('ChIJ123', {
      name: 'X', photos: [{ a: 1 }], reviews: [{ b: 2 }],
      authorAttribution: 'y', editorialSummary: 'z',
    });
    expect(clean).not.toHaveProperty('photos');
    expect(clean).not.toHaveProperty('reviews');
    expect(clean).not.toHaveProperty('authorAttribution');
    expect(clean).not.toHaveProperty('editorialSummary');
    expect(c.get('ChIJ123')).not.toHaveProperty('photos');
  });

  it('evicts oldest entries beyond maxEntries', () => {
    const c = new PlacesCache({ maxEntries: 2 });
    c.set('a', { name: 'a' });
    c.set('b', { name: 'b' });
    c.set('c', { name: 'c' });
    expect(c.size()).toBe(2);
    expect(c.get('a')).toBeNull();
    expect(c.get('c')).toMatchObject({ name: 'c' });
  });
});

describe('restaurant record + place_id schema', () => {
  it('accepts a plausible place_id, rejects garbage', () => {
    expect(googlePlaceIdSchema.safeParse('ChIJN1t_tDeuEmsRUsoyG83frY').success).toBe(true);
    expect(googlePlaceIdSchema.safeParse('short').success).toBe(false);
    expect(googlePlaceIdSchema.safeParse('has space!!').success).toBe(false);
  });

  it('restaurant record keeps google_place_id optional (existing rows valid)', () => {
    const base = {
      restaurant_id: 'r001', name: 'Buka Hut', city: 'Lagos', ambience: 'buka',
      spice_profile: 'hot', cuisine_tags: [], signature_dishes: [], social_tags: [],
      price_range_naira: { min: 1500, max: 5000 },
    };
    expect(restaurantSchema.safeParse(base).success).toBe(true);
    expect(restaurantSchema.safeParse({ ...base, google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY' }).success).toBe(true);
    expect(restaurantSchema.safeParse({ ...base, google_place_id: 'no' }).success).toBe(false);
  });
});
