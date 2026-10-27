import { getPool } from './pool.js';

// Single catalogue read path: every consumer queries Postgres (pg-mem in
// tests, Neon in prod). Curated rows carry their full original object in
// `meta`; OSM rows are rebuilt from columns. restaurants.json is only the
// seed fixture — never read at request time.
export const mapRow = (row) => {
  if (row.meta) {
    const m = typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta;
    return { ...m, _source: row.source };
  }
  return {
    restaurant_id: row.osm_id,
    name: row.name,
    city: row.city,
    area: row.area,
    address: row.address,
    cuisine_tags: (row.cuisine || '').split(';').map((s) => s.trim()).filter(Boolean),
    ambience: 'casual',
    price_tier: 'mid',
    price_range_naira: null,
    spice_profile: 'medium',
    social_tags: [],
    signature_dishes: [],
    average_rating: row.average_rating || null,
    review_count: row.review_count || 0,
    dietary_options: ['none'],
    description: 'Listed via OpenStreetMap — details pending verification.',
    opening_hours: row.opening_hours,
    phone: row.phone,
    website: row.website,
    lat: row.lat === null || row.lat === undefined ? null : Number(row.lat),
    lng: row.lng === null || row.lng === undefined ? null : Number(row.lng),
    _source: row.source,
  };
};

export const getCatalogue = async () => {
  const pool = await getPool();
  const { rows } = await pool.query('SELECT * FROM restaurants ORDER BY id');
  return rows.map(mapRow);
};

export const getCatalogueByCity = async (city) => {
  const pool = await getPool();
  const { rows } = await pool.query(
    'SELECT * FROM restaurants WHERE lower(city) = lower($1) ORDER BY id', [city]
  );
  return rows.map(mapRow);
};

export const getRestaurantsByCodes = async (codes) => {
  if (!codes.length) return [];
  const pool = await getPool();
  // Dynamic IN-list (not = ANY): identical on real Postgres and pg-mem.
  const placeholders = codes.map((_, i) => `$${i + 1}`).join(',');
  const { rows } = await pool.query(
    `SELECT * FROM restaurants WHERE code IN (${placeholders})`, codes
  );
  return rows.map(mapRow);
};

export const getRestaurantsInBox = async (minLat, maxLat, minLng, maxLng) => {
  const pool = await getPool();
  const { rows } = await pool.query(
    'SELECT * FROM restaurants WHERE lat BETWEEN $1 AND $2 AND lng BETWEEN $3 AND $4',
    [minLat, maxLat, minLng, maxLng]
  );
  return rows.map(mapRow);
};

export const findRestaurantByCode = async (code) => {
  if (!code || typeof code !== 'string') return undefined;
  const pool = await getPool();
  const { rows } = await pool.query(
    'SELECT * FROM restaurants WHERE code = $1 OR osm_id = $1', [code]
  );
  return rows[0] ? mapRow(rows[0]) : undefined;
};

export const findRestaurantsByName = async (needle) => {
  if (!needle || typeof needle !== 'string') return [];
  const pool = await getPool();
  const { rows } = await pool.query(
    'SELECT * FROM restaurants WHERE lower(name) LIKE $1 ORDER BY id',
    ['%' + needle.toLowerCase() + '%']
  );
  return rows.map(mapRow);
};
