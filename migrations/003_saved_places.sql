-- 003: Saved places (free-text "save a spot" list, separate from favorites).
CREATE TABLE IF NOT EXISTS saved_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  area TEXT,
  price_per_head_ngn INTEGER,
  price_source TEXT NOT NULL DEFAULT 'unknown',
  hours TEXT,
  hours_source TEXT NOT NULL DEFAULT 'unknown',
  status TEXT NOT NULL DEFAULT 'unverified',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_places_user_id ON saved_places (user_id);
