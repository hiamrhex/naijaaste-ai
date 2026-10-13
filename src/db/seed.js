// One-time catalogue seed: the 60 curated rows from restaurants.json become
// PG rows (code = r001…, meta = full original object). Safe to re-run:
// ON CONFLICT (code) DO NOTHING. restaurants.json stays as the seed fixture,
// not a runtime store.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logger } from '../lib/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_FILE = join(__dirname, '../data/restaurants.json');

export const seedCatalogue = async (pool) => {
  let rows;
  try {
    rows = JSON.parse(readFileSync(SEED_FILE, 'utf-8'));
  } catch (err) {
    logger.error({ err }, 'catalogue seed file unreadable');
    return { seeded: 0 };
  }
  if (!Array.isArray(rows)) rows = Object.values(rows);
  let seeded = 0;
  for (const r of rows) {
    if (!r.restaurant_id) continue;
    await pool.query(
      `INSERT INTO restaurants
         (osm_id, code, name, city, area, address, cuisine, opening_hours, phone, website,
          lat, lng, quality_flag, source, verified, meta, first_seen, last_seen)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, now(), now())
       ON CONFLICT (code) DO NOTHING`,
      ['curated:' + r.restaurant_id, r.restaurant_id, r.name || 'Unknown', r.city || 'Lagos', r.area || null,
        r.address || null, (r.cuisine_tags || []).join('; ') || null,
        r.opening_hours || null, r.phone || null, r.website || null,
        typeof r.lat === 'number' ? r.lat : null,
        typeof r.lng === 'number' ? r.lng : null,
        'ok', 'curated', true,
        JSON.stringify(r)]
    );
    seeded += 1;
  }
  return { seeded };
};
