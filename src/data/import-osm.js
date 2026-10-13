// OSM → Postgres import. Run: node src/data/import-osm.js [--city=Lagos] [--all]
// Default: Lagos, Abuja, Port Harcourt, Ibadan (goal step 1).
// Polite by design: proper User-Agent, ~1.5s between city requests, mirrors
// as fallback. Nameless elements are dropped before they reach the database.
// Attribution: © OpenStreetMap contributors (ODbL) — shown in logs, API
// responses, README, and the frontend map.
import { CITY_BBOX, normalizeOsmElement } from './refresh.js';
import { getPool, closePool } from '../db/pool.js';
import { logger } from '../lib/logger.js';

export const OSM_ATTRIBUTION = '© OpenStreetMap contributors (ODbL)';
export const IMPORT_CITIES = ['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan'];

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const UA = 'NaijaTasteAI/1.0 (restaurant catalogue import; contact: team-prime)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fetchCityElements = async (city, fetchFn) => {
  const [s, w, n, e] = CITY_BBOX[city];
  const q = `[out:json][timeout:60];node["amenity"~"restaurant|cafe|fast_food"](${s},${w},${n},${e});out body;`;
  let lastErr = null;
  for (const url of OVERPASS_MIRRORS) {
    try {
      const res = await fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': UA,
        },
        body: 'data=' + encodeURIComponent(q),
        signal: AbortSignal.timeout(90000),
      });
      if (!res.ok) throw new Error(`overpass ${res.status}`);
      const data = await res.json();
      return (data.elements || []).slice(0, 300);
    } catch (err) {
      lastErr = err;
      logger.warn({ city, url, err: err.message }, 'overpass mirror failed, trying next');
    }
  }
  const err = new Error(`all overpass mirrors failed for ${city}: ${lastErr?.message}`);
  err.code = 'OSM_FETCH_FAILED';
  throw err;
};

// Entries: normalized { osm_id, name, city, area, address, cuisine_tags,
// opening_hours, phone, website, lat, lng }. Returns { added, updated }.
export const upsertRestaurants = async (db, entries) => {
  if (!entries.length) return { added: 0, updated: 0 };
  const ids = entries.map((e) => e.osm_id);
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const { rows } = await db.query(`SELECT osm_id FROM restaurants WHERE osm_id IN (${placeholders})`, ids);
  const existing = new Set(rows.map((r) => r.osm_id));
  let added = 0;
  let updated = 0;
  for (const e of entries) {
    await db.query(
      `INSERT INTO restaurants
         (osm_id, name, city, area, address, cuisine, opening_hours, phone, website, lat, lng, last_seen)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
       ON CONFLICT (osm_id) DO UPDATE SET
         name = EXCLUDED.name, area = EXCLUDED.area, address = EXCLUDED.address,
         cuisine = EXCLUDED.cuisine, opening_hours = EXCLUDED.opening_hours,
         phone = EXCLUDED.phone, website = EXCLUDED.website,
         lat = EXCLUDED.lat, lng = EXCLUDED.lng, last_seen = now()`,
      [e.osm_id, e.name, e.city, e.area || null, e.address || null,
        (e.cuisine_tags || []).join('; ') || null, e.opening_hours || null,
        e.phone || null, e.website || null, e.lat ?? null, e.lng ?? null]
    );
    if (existing.has(e.osm_id)) updated += 1;
    else { added += 1; existing.add(e.osm_id); }
  }
  return { added, updated };
};

export const importCity = async (db, city, { fetchFn = fetch, delayMs = 1500 } = {}) => {
  if (!CITY_BBOX[city]) {
    const err = new Error(`unknown city: ${city}`);
    err.code = 'OSM_UNKNOWN_CITY';
    throw err;
  }
  const now = new Date().toISOString();
  const elements = await fetchCityElements(city, fetchFn);
  const kept = elements
    .map((el) => normalizeOsmElement(el, city, now))
    .filter(Boolean);
  const { added, updated } = await upsertRestaurants(db, kept);
  if (delayMs > 0) await sleep(delayMs);
  return { city, fetched: elements.length, kept: kept.length, added, updated };
};

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('data/import-osm.js');

if (isMain) {
  const args = Object.fromEntries(
    process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
      const [k, v] = a.slice(2).split('=');
      return [k, v === undefined ? true : v];
    })
  );
  const cities = args.all ? Object.keys(CITY_BBOX)
    : args.city ? [args.city] : IMPORT_CITIES;
  try {
    const db = await getPool();
    const totals = { fetched: 0, kept: 0, added: 0, updated: 0 };
    for (const city of cities) {
      const r = await importCity(db, city);
      totals.fetched += r.fetched;
      totals.kept += r.kept;
      totals.added += r.added;
      totals.updated += r.updated;
      logger.info({ ...r, attribution: OSM_ATTRIBUTION }, 'osm import');
    }
    console.log(JSON.stringify({ ...totals, attribution: OSM_ATTRIBUTION }));
  } catch (err) {
    logger.error({ err: err.message, code: err.code }, 'osm import failed');
    console.error(`import failed: ${err.code || err.message}`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
