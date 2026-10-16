-- 003: user-scoped saved places (memory-first wishlist).
-- Private to the user, nullable price/hours, never a catalogue row.
-- Portable types only (Neon + pg-mem): TEXT, INTEGER, TIMESTAMPTZ.

CREATE TABLE IF NOT EXISTS saved_places (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  catalogue_id TEXT,
  name TEXT NOT NULL,
  area TEXT,
  source_url TEXT,
  price_per_head_ngn INTEGER,
  price_source TEXT NOT NULL DEFAULT 'unknown',
  hours TEXT,
  hours_source TEXT NOT NULL DEFAULT 'unknown',
  status TEXT NOT NULL DEFAULT 'unverified',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saved_places_user ON saved_places (user_id);
