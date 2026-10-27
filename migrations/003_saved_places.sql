-- 003: Saved places table for favorites
CREATE TABLE IF NOT EXISTS saved_places (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_places_user_restaurant ON saved_places (user_id, restaurant_id);
CREATE INDEX IF NOT EXISTS idx_saved_places_user_id ON saved_places (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_places_restaurant_id ON saved_places (restaurant_id);