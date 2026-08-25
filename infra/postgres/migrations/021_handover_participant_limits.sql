BEGIN;

-- Existing v1.3.3/v1.3.4 rows were written without participant_role even though
-- actor_user_id already identifies the side. Temporarily remove the immutability
-- trigger so the migration can repair metadata once.
DROP TRIGGER IF EXISTS trg_handover_evidence_immutable ON deal_handover_evidence;

UPDATE deal_handover_evidence e
SET participant_role = CASE
  WHEN e.actor_user_id = d.driver_id THEN 'driver'
  WHEN e.actor_user_id = d.sender_id THEN 'sender'
  ELSE e.participant_role
END
FROM deal d
WHERE e.deal_id = d.id
  AND e.participant_role IS NULL;

UPDATE deal_handover_evidence e
SET handover_session_id = hs.id,
    synchronization_grade = CASE
      WHEN e.stage <> 'delivery' OR hs.started_at IS NULL THEN e.synchronization_grade
      WHEN e.server_captured_at <= hs.started_at + interval '60 seconds' THEN 'strong'
      WHEN e.server_captured_at <= hs.started_at + interval '120 seconds' THEN 'acceptable'
      ELSE 'late'
    END
FROM deal_handover_session hs
WHERE e.deal_id = hs.deal_id
  AND e.stage = 'delivery'
  AND (e.handover_session_id IS NULL OR e.synchronization_grade IS NULL);

-- Limit semantics:
-- pickup: up to 3 driver photos for the stage;
-- delivery: independently up to 3 driver + up to 3 sender photos.
CREATE OR REPLACE FUNCTION enforce_handover_evidence_limit() RETURNS trigger AS $$
DECLARE existing_count integer;
DECLARE lock_key text;
BEGIN
  IF NEW.participant_role IS NULL THEN
    RAISE EXCEPTION 'handover participant role required' USING ERRCODE='23514';
  END IF;
  IF NEW.stage = 'pickup' AND NEW.participant_role <> 'driver' THEN
    RAISE EXCEPTION 'pickup evidence must belong to driver' USING ERRCODE='23514';
  END IF;

  lock_key := NEW.deal_id::text || ':' || NEW.stage || ':' ||
    CASE WHEN NEW.stage='delivery' THEN NEW.participant_role ELSE 'driver' END;
  PERFORM pg_advisory_xact_lock(hashtext(lock_key));

  IF NEW.stage = 'delivery' THEN
    SELECT count(*) INTO existing_count
    FROM deal_handover_evidence
    WHERE deal_id=NEW.deal_id AND stage='delivery' AND participant_role=NEW.participant_role;
  ELSE
    SELECT count(*) INTO existing_count
    FROM deal_handover_evidence
    WHERE deal_id=NEW.deal_id AND stage='pickup';
  END IF;

  IF existing_count >= 3 THEN
    RAISE EXCEPTION 'handover evidence limit reached' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_handover_evidence_limit ON deal_handover_evidence;
CREATE TRIGGER trg_handover_evidence_limit
BEFORE INSERT ON deal_handover_evidence
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

CREATE INDEX IF NOT EXISTS deal_handover_evidence_stage_role_idx
ON deal_handover_evidence(deal_id,stage,participant_role,server_captured_at);

COMMIT;
