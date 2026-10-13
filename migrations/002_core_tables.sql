-- 002: core application tables (users, sessions, OTP, ratings, reports).
-- Replaces JSON-file stores and the in-memory OTP map. Works on Neon
-- Postgres and on pg-mem (tests): only portable types used (no CITEXT,
-- no arrays, no extensions). Ids are UUID strings generated in JS.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  google_sub TEXT,
  picture TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  jti TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);

CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  restaurant_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, restaurant_id)
);

CREATE TABLE IF NOT EXISTS otps (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

CREATE TABLE IF NOT EXISTS ratings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  restaurant_id TEXT NOT NULL,
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  note TEXT,
  context TEXT NOT NULL DEFAULT 'saved',
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ratings_user ON ratings (user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_restaurant ON ratings (restaurant_id);

CREATE TABLE IF NOT EXISTS reports (
  ticket TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  screen TEXT,
  device TEXT,
  app_version TEXT,
  request_id TEXT,
  restaurant_id TEXT,
  has_screenshot BOOLEAN NOT NULL DEFAULT false,
  screenshot TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status);

-- Catalogue: link curated rows and add a JSONB meta column for rich fields.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS meta JSONB;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_restaurants_code ON restaurants (code);
CREATE INDEX IF NOT EXISTS idx_restaurants_city ON restaurants (city);
