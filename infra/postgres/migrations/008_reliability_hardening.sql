-- Reliability hardening for trip creation / vehicle lifecycle.
-- Intentionally additive: no existing user data is removed.

ALTER TABLE vehicle
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
ALTER TABLE vehicle
  ADD COLUMN IF NOT EXISTS client_reference TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_owner_client_reference_uq
  ON vehicle(owner_id, client_reference)
  WHERE client_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS vehicle_owner_active_recent_idx
  ON vehicle(owner_id, status, COALESCE(last_used_at, created_at) DESC);

ALTER TABLE trip
  ADD COLUMN IF NOT EXISTS departure_source TEXT NOT NULL DEFAULT 'legacy_absolute'
  CHECK (departure_source IN ('legacy_absolute','server_relative','absolute_timezone_aware'));

CREATE INDEX IF NOT EXISTS trip_status_departure_idx
  ON trip(status, departure_from);
