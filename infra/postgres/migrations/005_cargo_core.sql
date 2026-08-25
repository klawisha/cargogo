ALTER TABLE cargo ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE cargo ADD COLUMN IF NOT EXISTS length_cm NUMERIC(8,2);
ALTER TABLE cargo ADD COLUMN IF NOT EXISTS width_cm NUMERIC(8,2);
ALTER TABLE cargo ADD COLUMN IF NOT EXISTS height_cm NUMERIC(8,2);
ALTER TABLE cargo ADD COLUMN IF NOT EXISTS pickup_public_label TEXT;
ALTER TABLE cargo ADD COLUMN IF NOT EXISTS delivery_public_label TEXT;
ALTER TABLE cargo ADD COLUMN IF NOT EXISTS pickup_address_private TEXT;
ALTER TABLE cargo ADD COLUMN IF NOT EXISTS delivery_address_private TEXT;
ALTER TABLE cargo ADD COLUMN IF NOT EXISTS fragile BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE cargo ADD COLUMN IF NOT EXISTS photo_count INTEGER NOT NULL DEFAULT 0 CHECK (photo_count >= 0 AND photo_count <= 8);

CREATE TABLE IF NOT EXISTS cargo_photo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_id UUID NOT NULL REFERENCES cargo(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
  width_px INTEGER,
  height_px INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cargo_photo_cargo_idx ON cargo_photo(cargo_id, created_at);

CREATE INDEX IF NOT EXISTS cargo_owner_created_idx ON cargo(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cargo_owner_status_idx ON cargo(owner_id, status, created_at DESC);
