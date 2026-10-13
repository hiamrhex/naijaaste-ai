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
  const clean = rows.filter((r) => r.restaurant_id);
  if (!clean.length) return { seeded: 0 };
  // Single multi-row INSERT: per-file test setup stays fast.
  const values = [];
  const params = [];
  clean.forEach((r, i) => {
    const base = i * 16;
    values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13},$${base + 14},$${base + 15},$${base + 16}, now(), now())`);
    params.push(
      'curated:' + r.restaurant_id, r.restaurant_id, r.name || 'Unknown', r.city || 'Lagos',
      r.area || null, r.address || null, (r.cuisine_tags || []).join('; ') || null,
      r.opening_hours || null, r.phone || null, r.website || null,
      typeof r.lat === 'number' ? r.lat : null,
      typeof r.lng === 'number' ? r.lng : null,
      'ok', 'curated', true, JSON.stringify(r)
    );
  });
  await pool.query(
    `INSERT INTO restaurants
       (osm_id, code, name, city, area, address, cuisine, opening_hours, phone, website,
        lat, lng, quality_flag, source, verified, meta, first_seen, last_seen)
     VALUES ${values.join(',')}
     ON CONFLICT (code) DO NOTHING`,
    params
  );
  return { seeded: clean.length };
};
