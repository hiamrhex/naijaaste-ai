// Ephemeral Google Places content cache — policy compliance by construction.
//
// Per the Places API (New) policies (developers.google.com/maps/documentation
// /places/web-service/policies, fetched 2026-10-11):
//   - place_id is EXEMPT from caching restrictions → stored indefinitely in
//     our own restaurant records (see restaurantSchema.google_place_id).
//   - All other Places content (names, ratings, hours, phone, photos, reviews)
//     must NOT be pre-fetched, cached, or stored beyond narrow exceptions.
// This module is therefore:
//   - memory-only (no disk, no DB, no logs of Google content),
//   - short-TTL (default 30 min — display freshness, not storage),
//   - field-whitelisted (only the display fields our endpoints serve),
//   - bounded (LRU-ish eviction at maxEntries).
// Photos and reviews are never cached here at all.
const ALLOWED_FIELDS = new Set([
  'placeId', 'name', 'openNow', 'hours', 'rating',
  'userRatingCount', 'phone', 'address', 'fetchedAt',
]);

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 500;

export class PlacesCache {
  constructor({ ttlMs = DEFAULT_TTL_MS, maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.store = new Map(); // placeId -> { data, expiresAt }
  }

  get(placeId) {
    const rec = this.store.get(placeId);
    if (!rec) return null;
    if (Date.now() > rec.expiresAt) {
      this.store.delete(placeId);
      return null;
    }
    // Refresh recency without extending life.
    this.store.delete(placeId);
    this.store.set(placeId, rec);
    return rec.data;
  }

  set(placeId, data) {
    const clean = {};
    for (const k of Object.keys(data || {})) {
      if (ALLOWED_FIELDS.has(k)) clean[k] = data[k];
    }
    clean.placeId = placeId;
    clean.fetchedAt = new Date().toISOString();
    if (this.store.has(placeId)) this.store.delete(placeId);
    this.store.set(placeId, { data: clean, expiresAt: Date.now() + this.ttlMs });
    while (this.store.size > this.maxEntries) {
      this.store.delete(this.store.keys().next().value);
    }
    return clean;
  }

  size() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }
}

export const placesCache = new PlacesCache();
export const PLACES_CACHE_TTL_MS = DEFAULT_TTL_MS;
