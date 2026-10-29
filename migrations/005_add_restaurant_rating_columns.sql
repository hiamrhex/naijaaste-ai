-- 005: Add rating columns to restaurants for deterministic fallback ordering.
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS average_rating DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0;