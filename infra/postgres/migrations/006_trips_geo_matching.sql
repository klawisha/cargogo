CREATE TABLE IF NOT EXISTS vehicle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  body_type TEXT NOT NULL CHECK (body_type IN ('sedan','hatchback','wagon','suv','van','pickup','other')),
  max_payload_kg NUMERIC(8,2),
  cargo_length_cm NUMERIC(8,2),
  cargo_width_cm NUMERIC(8,2),
  cargo_height_cm NUMERIC(8,2),
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified','pending','verified','rejected')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vehicle_owner_status_idx ON vehicle(owner_id, status, created_at DESC);

ALTER TABLE trip ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicle(id);
ALTER TABLE trip ADD COLUMN IF NOT EXISTS origin_public_label TEXT;
ALTER TABLE trip ADD COLUMN IF NOT EXISTS destination_public_label TEXT;
ALTER TABLE trip ADD COLUMN IF NOT EXISTS origin_address_private TEXT;
ALTER TABLE trip ADD COLUMN IF NOT EXISTS destination_address_private TEXT;
ALTER TABLE trip ADD COLUMN IF NOT EXISTS capacity_kg NUMERIC(8,2);
ALTER TABLE trip ADD COLUMN IF NOT EXISTS capacity_length_cm NUMERIC(8,2);
ALTER TABLE trip ADD COLUMN IF NOT EXISTS capacity_width_cm NUMERIC(8,2);
ALTER TABLE trip ADD COLUMN IF NOT EXISTS capacity_height_cm NUMERIC(8,2);
ALTER TABLE trip ADD COLUMN IF NOT EXISTS route_distance_m INTEGER CHECK (route_distance_m IS NULL OR route_distance_m >= 0);
ALTER TABLE trip ADD COLUMN IF NOT EXISTS route_duration_s INTEGER CHECK (route_duration_s IS NULL OR route_duration_s >= 0);
ALTER TABLE trip ADD COLUMN IF NOT EXISTS route_source TEXT NOT NULL DEFAULT 'fallback';
ALTER TABLE trip ADD COLUMN IF NOT EXISTS route_quality TEXT NOT NULL DEFAULT 'rough' CHECK (route_quality IN ('rough','routed'));

CREATE INDEX IF NOT EXISTS trip_driver_created_idx ON trip(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trip_driver_status_idx ON trip(driver_id, status, departure_from);

CREATE TABLE IF NOT EXISTS trip_match (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
  cargo_id UUID NOT NULL REFERENCES cargo(id) ON DELETE CASCADE,
  pickup_distance_m INTEGER NOT NULL CHECK (pickup_distance_m >= 0),
  delivery_distance_m INTEGER NOT NULL CHECK (delivery_distance_m >= 0),
  pickup_fraction DOUBLE PRECISION NOT NULL CHECK (pickup_fraction >= 0 AND pickup_fraction <= 1),
  delivery_fraction DOUBLE PRECISION NOT NULL CHECK (delivery_fraction >= 0 AND delivery_fraction <= 1),
  estimated_extra_m INTEGER NOT NULL CHECK (estimated_extra_m >= 0),
  score SMALLINT NOT NULL CHECK (score >= 0 AND score <= 100),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id, cargo_id)
);
CREATE INDEX IF NOT EXISTS trip_match_trip_score_idx ON trip_match(trip_id, score DESC, computed_at DESC);
CREATE INDEX IF NOT EXISTS trip_match_cargo_idx ON trip_match(cargo_id, computed_at DESC);
