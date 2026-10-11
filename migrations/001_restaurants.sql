-- 001: OSM restaurant catalogue (free data, no card).
-- One row per OpenStreetMap element; our own curated data lives in step-3 tables.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restaurants (
  id SERIAL PRIMARY KEY,
  osm_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  area TEXT,
  address TEXT,
  cuisine TEXT,
  opening_hours TEXT,
  phone TEXT,
  website TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  quality_flag TEXT NOT NULL DEFAULT 'ok',
  source TEXT NOT NULL DEFAULT 'osm',
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restaurants_city ON restaurants (city);
CREATE INDEX IF NOT EXISTS idx_restaurants_coords ON restaurants (lat, lng);
CREATE INDEX IF NOT EXISTS idx_restaurants_quality ON restaurants (quality_flag);
