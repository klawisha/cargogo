BEGIN;
CREATE TABLE IF NOT EXISTS driver_match_context (
  user_id uuid PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES trip(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_driver_match_context_trip ON driver_match_context(trip_id) WHERE trip_id IS NOT NULL;
INSERT INTO driver_match_context(user_id,trip_id)
SELECT driver_id,id FROM (
  SELECT DISTINCT ON (driver_id) driver_id,id,created_at FROM trip ORDER BY driver_id,created_at DESC
) x
ON CONFLICT(user_id) DO NOTHING;
COMMIT;
