-- Add missing /metrics endpoint for SLO monitoring
-- This endpoint returns Prometheus-formatted metrics for observability
CREATE TABLE IF NOT EXISTS metrics (
  id SERIAL PRIMARY KEY,
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  status INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create a view for Prometheus metrics
CREATE OR REPLACE VIEW prometheus_metrics AS
SELECT 
  CONCAT('http_requests_total{method=', method, ',status=', status::text, '}') AS metric_name,
  COUNT(*) AS value
FROM metrics 
GROUP BY method, status;