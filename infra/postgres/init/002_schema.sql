CREATE TABLE IF NOT EXISTS app_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  phone_e164 TEXT UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cargo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES app_user(id),
  title TEXT NOT NULL,
  description TEXT,
  weight_kg NUMERIC(8,2),
  reward_minor INTEGER NOT NULL CHECK (reward_minor >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'UAH',
  pickup_point GEOGRAPHY(POINT, 4326) NOT NULL,
  delivery_point GEOGRAPHY(POINT, 4326) NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','matched','in_transit','delivered','cancelled')),
  pickup_from TIMESTAMPTZ,
  pickup_until TIMESTAMPTZ,
  delivery_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cargo_pickup_gix ON cargo USING GIST (pickup_point);
CREATE INDEX IF NOT EXISTS cargo_delivery_gix ON cargo USING GIST (delivery_point);
CREATE INDEX IF NOT EXISTS cargo_status_created_idx ON cargo(status, created_at DESC);

CREATE TABLE IF NOT EXISTS trip (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES app_user(id),
  origin GEOGRAPHY(POINT, 4326) NOT NULL,
  destination GEOGRAPHY(POINT, 4326) NOT NULL,
  route GEOGRAPHY(LINESTRING, 4326),
  departure_from TIMESTAMPTZ NOT NULL,
  departure_until TIMESTAMPTZ,
  max_detour_km NUMERIC(6,2) NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','active','completed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trip_origin_gix ON trip USING GIST (origin);
CREATE INDEX IF NOT EXISTS trip_destination_gix ON trip USING GIST (destination);
CREATE INDEX IF NOT EXISTS trip_route_gix ON trip USING GIST (route);
