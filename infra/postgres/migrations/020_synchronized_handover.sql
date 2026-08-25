BEGIN;
CREATE TABLE IF NOT EXISTS deal_handover_session (
  id uuid PRIMARY KEY,
  deal_id uuid NOT NULL UNIQUE REFERENCES deal(id) ON DELETE RESTRICT,
  driver_arrived_at timestamptz,
  driver_arrival_latitude numeric(9,6), driver_arrival_longitude numeric(9,6), driver_arrival_accuracy_meters numeric(10,2),
  recipient_present_at timestamptz,
  recipient_latitude numeric(9,6), recipient_longitude numeric(9,6), recipient_accuracy_meters numeric(10,2),
  started_at timestamptz,
  started_by uuid REFERENCES app_user(id) ON DELETE RESTRICT,
  strong_window_seconds integer NOT NULL DEFAULT 60 CHECK(strong_window_seconds BETWEEN 30 AND 300),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE deal_handover_evidence ADD COLUMN IF NOT EXISTS handover_session_id uuid REFERENCES deal_handover_session(id) ON DELETE RESTRICT;
ALTER TABLE deal_handover_evidence ADD COLUMN IF NOT EXISTS participant_role text;
ALTER TABLE deal_handover_evidence ADD COLUMN IF NOT EXISTS synchronization_grade text;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='deal_handover_evidence_participant_role_chk') THEN ALTER TABLE deal_handover_evidence ADD CONSTRAINT deal_handover_evidence_participant_role_chk CHECK(participant_role IS NULL OR participant_role IN ('driver','sender')); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='deal_handover_evidence_sync_grade_chk') THEN ALTER TABLE deal_handover_evidence ADD CONSTRAINT deal_handover_evidence_sync_grade_chk CHECK(synchronization_grade IS NULL OR synchronization_grade IN ('strong','acceptable','late')); END IF;
END $$;
CREATE INDEX IF NOT EXISTS deal_handover_evidence_session_idx ON deal_handover_evidence(handover_session_id,participant_role,server_captured_at);
COMMIT;
