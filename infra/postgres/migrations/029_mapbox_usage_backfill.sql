-- v1.5.2: if Mapbox routing was already used before the finance usage counter existed,
-- preserve a conservative lower bound. Every persisted mapbox-directions-v5 trip proves
-- at least one successful Directions request. Existing counters are never reduced.
WITH observed AS (
  SELECT count(*)::bigint AS value
  FROM trip
  WHERE route_source = 'mapbox-directions-v5'
    AND coalesce(updated_at, created_at) >= date_trunc('month', now())
)
INSERT INTO service_usage_counter(service_key, metric_key, period_start, usage_value)
SELECT 'mapbox_directions', 'requests', date_trunc('month', now())::date, value
FROM observed
WHERE value > 0
ON CONFLICT(service_key, metric_key, period_start)
DO UPDATE SET
  usage_value = GREATEST(service_usage_counter.usage_value, EXCLUDED.usage_value),
  updated_at = now();

WITH observed AS (
  SELECT count(*)::bigint AS value
  FROM trip
  WHERE route_source = 'mapbox-directions-v5'
    AND coalesce(updated_at, created_at) >= date_trunc('month', now())
)
INSERT INTO service_usage_counter(service_key, metric_key, period_start, usage_value)
SELECT 'mapbox_directions', 'routed', date_trunc('month', now())::date, value
FROM observed
WHERE value > 0
ON CONFLICT(service_key, metric_key, period_start)
DO UPDATE SET
  usage_value = GREATEST(service_usage_counter.usage_value, EXCLUDED.usage_value),
  updated_at = now();
