BEGIN;

CREATE TABLE IF NOT EXISTS deal_handover_evidence (
  id uuid PRIMARY KEY,
  deal_id uuid NOT NULL REFERENCES deal(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  stage text NOT NULL CHECK (stage IN ('pickup','delivery')),
  object_key text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png')),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  sha256_hex text NOT NULL CHECK (sha256_hex ~ '^[0-9a-f]{64}$'),
  note text,
  server_captured_at timestamptz NOT NULL DEFAULT now(),
  retention_until timestamptz NOT NULL DEFAULT (now() + interval '180 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deal_handover_evidence_deal_stage_idx ON deal_handover_evidence(deal_id,stage,created_at);
CREATE INDEX IF NOT EXISTS deal_handover_evidence_retention_idx ON deal_handover_evidence(retention_until);

CREATE TABLE IF NOT EXISTS deal_handover_evidence_access_log (
  id bigserial PRIMARY KEY,
  evidence_id uuid NOT NULL REFERENCES deal_handover_evidence(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  purpose text NOT NULL CHECK (char_length(purpose) BETWEEN 3 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);


CREATE OR REPLACE FUNCTION enforce_handover_evidence_limit() RETURNS trigger AS $$
DECLARE existing_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.deal_id::text || ':' || NEW.stage));
  SELECT count(*) INTO existing_count FROM deal_handover_evidence WHERE deal_id=NEW.deal_id AND stage=NEW.stage;
  IF existing_count >= 3 THEN RAISE EXCEPTION 'handover evidence limit reached' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_handover_evidence_limit ON deal_handover_evidence;
CREATE TRIGGER trg_handover_evidence_limit BEFORE INSERT ON deal_handover_evidence
FOR EACH ROW EXECUTE FUNCTION enforce_handover_evidence_limit();

CREATE OR REPLACE FUNCTION prevent_handover_evidence_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'deal handover evidence is immutable';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_handover_evidence_immutable ON deal_handover_evidence;
CREATE TRIGGER trg_handover_evidence_immutable
BEFORE UPDATE OR DELETE ON deal_handover_evidence
FOR EACH ROW EXECUTE FUNCTION prevent_handover_evidence_mutation();

COMMIT;
