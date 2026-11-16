-- 008: Functional index for the city lookup.
--
-- Every recommendation and fallback query filters with
--   WHERE lower(city) = lower($1)
-- but 002 only indexed the bare column, so a function on the column made that
-- index unusable and the statement scanned the whole catalogue.
--
-- The old index stays: it is still the right index for any future exact-match
-- lookup on the normalised value.

CREATE INDEX IF NOT EXISTS idx_restaurants_city_lower ON restaurants (lower(city));
