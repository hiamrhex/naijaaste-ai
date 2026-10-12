// Live catalogue refresh — OpenStreetMap (Overpass) → restaurants.json.
// Free, no API key. Run:  node src/data/refresh.js --city=Lagos
//                          node src/data/refresh.js --all [--stale-days=90]
// Curated entries are never overwritten — OSM only adds new listings and
// bumps last_seen on matches. Merge helpers are exported for unit tests.
import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logger } from '../lib/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOGUE_FILE = join(__dirname, 'restaurants.json');
const BACKUP_FILE = join(__dirname, 'restaurants.backup.json');
const META_FILE = join(__dirname, 'refresh-meta.json');

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

// south,west,north,east — generous boxes around each catalogue city
export const CITY_BBOX = {
  'Lagos': [6.35, 3.0, 6.75, 3.7],
  'Abuja': [8.9, 7.3, 9.3, 7.7],
  'Port Harcourt': [4.7, 6.9, 5.0, 7.15],
  'Ibadan': [7.2, 3.8, 7.6, 4.1],
  'Enugu': [6.3, 7.4, 6.6, 7.6],
  'Kano': [11.9, 8.4, 12.1, 8.7],
  'Calabar': [4.9, 8.25, 5.1, 8.45],
  'Benin City': [6.2, 5.5, 6.5, 5.75],
};

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

const samePlace = (a, b) => {
  if (a === b) return true;
  if (a.length > 6 && (a.includes(b) || b.includes(a))) return true;
  return false;
};

// OSM element → catalogue-shaped entry (conservative defaults; never
// invents ratings, prices, or Nigerian-specific fields).
export const normalizeOsmElement = (el, city, now) => {
  const tags = el.tags || {};
  if (!tags.name) return null;
  const cuisines = (tags.cuisine || '')
    .split(';').map((c) => c.trim()).filter(Boolean).slice(0, 3);
  return {
    restaurant_id: `osm-${el.type === 'node' ? 'n' : el.type[0]}${el.id}`,
    osm_id: `${el.type}/${el.id}`,
    name: tags.name,
    city,
    area: tags.suburb || tags.neighbourhood || tags.district || city,
    address: [tags['addr:street'], tags['addr:suburb'], tags['addr:city']].filter(Boolean).join(', ') || null,
    cuisine_tags: cuisines.length ? cuisines : ['Various'],
    ambience: 'casual',
    price_tier: 'mid',
    price_range_naira: null,
    spice_profile: 'medium',
    social_tags: [],
    signature_dishes: [],
    average_rating: null,
    review_count: 0,
    dietary_options: ['none'],
    description: 'Listed via OpenStreetMap — details pending verification.',
    opening_hours: tags.opening_hours || null,
    phone: tags.phone || null,
    website: tags.website || null,
    lat: el.lat ?? el.center?.lat ?? null,
    lng: el.lon ?? el.center?.lon ?? null,
    source: 'osm',
    verified: false,
    stale: false,
    first_seen: now,
    last_seen: now,
  };
};

// Merge fetched entries into the catalogue. Returns { catalogue, added, matched }.
export const mergeCatalogue = (catalogue, fetched, now) => {
  let added = 0;
  let matched = 0;
  // Backfill provenance on legacy entries once.
  for (const r of catalogue) {
    if (!r.source) {
      r.source = 'curated';
      r.verified = true;
      r.first_seen = r.first_seen || now;
      r.last_seen = r.last_seen || now;
      r.stale = false;
    }
  }
  const byOsmId = new Map(catalogue.filter((r) => r.osm_id).map((r) => [r.osm_id, r]));
  for (const f of fetched) {
    if (!f) continue;
    const byId = byOsmId.get(f.osm_id);
    if (byId) {
      byId.last_seen = now;
      byId.stale = false;
      matched += 1;
      continue;
    }
    const dupe = catalogue.find(
      (r) => r.city === f.city && samePlace(norm(r.name), norm(f.name))
    );
    if (dupe) {
      dupe.osm_id = dupe.osm_id || f.osm_id;
      dupe.last_seen = now;
      dupe.stale = false;
      matched += 1;
      continue;
    }
    catalogue.push(f);
    byOsmId.set(f.osm_id, f);
    added += 1;
  }
  return { catalogue, added, matched };
};

export const markStale = (catalogue, now, staleDays) => {
  const cutoff = now - staleDays * 24 * 60 * 60 * 1000;
  let staleCount = 0;
  for (const r of catalogue) {
    const seen = Date.parse(r.last_seen || r.first_seen || now);
    r.stale = seen < cutoff;
    if (r.stale) staleCount += 1;
  }
  return staleCount;
};

const fetchCity = async (city) => {
  const [s, w, n, e] = CITY_BBOX[city];
  const q = `[out:json][timeout:60];node["amenity"~"restaurant|cafe|fast_food"](${s},${w},${n},${e});out body;`;
  let lastErr = null;
  for (const url of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'NaijaTasteAI/1.0 (restaurant catalogue refresh)',
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
  throw new Error(`all overpass mirrors failed for ${city}: ${lastErr?.message}`);
};

const loadCatalogue = () => JSON.parse(readFileSync(CATALOGUE_FILE, 'utf-8'));

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('data/refresh.js');

if (isMain) {
  const args = Object.fromEntries(
    process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
      const [k, v] = a.slice(2).split('=');
      return [k, v === undefined ? true : v];
    })
  );
  const cities = args.all ? Object.keys(CITY_BBOX)
    : args.city ? [args.city] : [];
  if (!cities.length || cities.some((c) => !CITY_BBOX[c])) {
    console.error(`usage: node src/data/refresh.js --city=${Object.keys(CITY_BBOX).join('|')} | --all [--stale-days=90]`);
    process.exit(2);
  }
  const staleDays = Number(args['stale-days'] || 90);
  const now = new Date().toISOString();

  const catalogue = loadCatalogue();
  let fetchedTotal = 0;
  let addedTotal = 0;
  let matchedTotal = 0;
  for (const city of cities) {
    const els = await fetchCity(city);
    const normalized = els.map((el) => normalizeOsmElement(el, city, now)).filter(Boolean);
    fetchedTotal += normalized.length;
    const { added, matched } = mergeCatalogue(catalogue, normalized, now);
    addedTotal += added;
    matchedTotal += matched;
    logger.info({ city, fetched: normalized.length, added, matched }, 'catalogue refresh');
  }
  const staleCount = markStale(catalogue, Date.parse(now), staleDays);

  // Atomic write with one backup generation.
  if (existsSync(CATALOGUE_FILE)) {
    writeFileSync(BACKUP_FILE, readFileSync(CATALOGUE_FILE), 'utf-8');
  }
  const tmp = CATALOGUE_FILE + '.tmp';
  writeFileSync(tmp, JSON.stringify(catalogue, null, 2), 'utf-8');
  renameSync(tmp, CATALOGUE_FILE);
  const meta = {
    last_run: now, cities, fetched: fetchedTotal,
    added: addedTotal, matched: matchedTotal,
    stale: staleCount, total: catalogue.length, stale_days: staleDays,
  };
  writeFileSync(META_FILE, JSON.stringify(meta, null, 2), 'utf-8');
  console.log(JSON.stringify(meta));
}
