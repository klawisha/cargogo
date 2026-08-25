BEGIN;

ALTER TABLE deal_handover_evidence ADD COLUMN IF NOT EXISTS latitude numeric(9,6);
ALTER TABLE deal_handover_evidence ADD COLUMN IF NOT EXISTS longitude numeric(9,6);
ALTER TABLE deal_handover_evidence ADD COLUMN IF NOT EXISTS accuracy_meters numeric(10,2);
ALTER TABLE deal_handover_evidence ADD COLUMN IF NOT EXISTS client_captured_at timestamptz;
ALTER TABLE deal_handover_evidence ADD COLUMN IF NOT EXISTS location_status text NOT NULL DEFAULT 'unavailable';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='deal_handover_evidence_latitude_chk') THEN
    ALTER TABLE deal_handover_evidence ADD CONSTRAINT deal_handover_evidence_latitude_chk CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='deal_handover_evidence_longitude_chk') THEN
    ALTER TABLE deal_handover_evidence ADD CONSTRAINT deal_handover_evidence_longitude_chk CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='deal_handover_evidence_accuracy_chk') THEN
    ALTER TABLE deal_handover_evidence ADD CONSTRAINT deal_handover_evidence_accuracy_chk CHECK (accuracy_meters IS NULL OR accuracy_meters BETWEEN 0 AND 10000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='deal_handover_evidence_location_status_chk') THEN
    ALTER TABLE deal_handover_evidence ADD CONSTRAINT deal_handover_evidence_location_status_chk CHECK (location_status IN ('captured','permission_denied','unavailable'));
  END IF;
END $$;

ALTER TABLE deal_dispute DROP CONSTRAINT IF EXISTS deal_dispute_reason_code_check;
ALTER TABLE deal_dispute ADD CONSTRAINT deal_dispute_reason_code_check CHECK (
  reason_code IN ('cargo_damaged','cargo_missing','delivery_not_received','wrong_cargo','participant_unavailable','delivery_confirmation_refused','other')
);

CREATE TABLE IF NOT EXISTS deal_delivery_confirmation_problem (
  deal_id uuid PRIMARY KEY REFERENCES deal(id) ON DELETE RESTRICT,
  dispute_id uuid NOT NULL UNIQUE REFERENCES deal_dispute(id) ON DELETE RESTRICT,
  reported_by uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (reason IN ('recipient_refuses_code','recipient_claims_damage','recipient_unavailable','other')),
  note text NOT NULL CHECK (char_length(note) BETWEEN 3 AND 1500),
  latitude numeric(9,6),
  longitude numeric(9,6),
  accuracy_meters numeric(10,2),
  client_location_at timestamptz,
  location_status text NOT NULL CHECK (location_status IN ('captured','permission_denied','unavailable')),
  server_reported_at timestamptz NOT NULL DEFAULT now(),
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CHECK (accuracy_meters IS NULL OR accuracy_meters BETWEEN 0 AND 10000)
);
CREATE INDEX IF NOT EXISTS deal_delivery_confirmation_problem_dispute_idx ON deal_delivery_confirmation_problem(dispute_id);

CREATE OR REPLACE FUNCTION prevent_delivery_confirmation_problem_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'delivery confirmation problem evidence is immutable';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_delivery_confirmation_problem_immutable ON deal_delivery_confirmation_problem;
CREATE TRIGGER trg_delivery_confirmation_problem_immutable
BEFORE UPDATE OR DELETE ON deal_delivery_confirmation_problem
FOR EACH ROW EXECUTE FUNCTION prevent_delivery_confirmation_problem_mutation();

COMMIT;
