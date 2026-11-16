-- 007: Indexes for the hot paths that filter or sort on these columns.
--
-- Every one of these is read on a normal request, not an admin report:
--   ratings.user_id         GET /ratings (WHERE user_id = $1 ORDER BY at DESC)
--   reports.status          admin inbox (WHERE status = $1 ORDER BY at DESC)
--   otps.expires_at         every OTP request prunes expired rows first
--   auth_attempts.updated_at every failed sign-in prunes stale attempts first
--
-- Without them each of those statements is a sequential scan that grows with
-- the table. The composite indexes lead with the filtered column and carry the
-- sort column so the ORDER BY can be served from the index.

CREATE INDEX IF NOT EXISTS idx_ratings_user_at ON ratings (user_id, at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_status_at ON reports (status, at DESC);

CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON otps (expires_at);

CREATE INDEX IF NOT EXISTS idx_auth_attempts_updated_at ON auth_attempts (updated_at);
