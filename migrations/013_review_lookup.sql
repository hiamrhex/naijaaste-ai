-- Add review lookup test data
-- This helps test review tool lookup by ID before name fallback
CREATE TABLE IF NOT EXISTS review_lookup_tests (
  id SERIAL PRIMARY KEY,
  review_id UUID NOT NULL,
  restaurant_id TEXT NOT NULL,
  reviewer_id UUID NOT NULL,
  content TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_processed BOOLEAN NOT NULL DEFAULT false
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_review_lookup_tests_review_id ON review_lookup_tests (review_id);
CREATE INDEX IF NOT EXISTS idx_review_lookup_tests_restaurant_id ON review_lookup_tests (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_review_lookup_tests_is_processed ON review_lookup_tests (is_processed);