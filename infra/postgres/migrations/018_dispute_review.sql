-- CargoGo v1.3.1: practical dispute review workflow
ALTER TABLE deal_dispute ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES app_user(id) ON DELETE SET NULL;
ALTER TABLE deal_dispute ADD COLUMN IF NOT EXISTS review_started_at TIMESTAMPTZ;
ALTER TABLE deal_dispute ADD COLUMN IF NOT EXISTS resolution_code TEXT;
CREATE INDEX IF NOT EXISTS deal_dispute_review_queue_idx ON deal_dispute(status,created_at) WHERE status IN ('open','under_review');

CREATE TABLE IF NOT EXISTS dispute_evidence_access_log (
  id BIGSERIAL PRIMARY KEY,
  evidence_id BIGINT NOT NULL REFERENCES dispute_evidence(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  purpose TEXT NOT NULL CHECK (char_length(purpose) BETWEEN 3 AND 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dispute_evidence_access_idx ON dispute_evidence_access_log(evidence_id,created_at DESC);
