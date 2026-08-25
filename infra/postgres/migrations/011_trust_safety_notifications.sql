CREATE TABLE IF NOT EXISTS user_notification (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_notification_user_idx ON user_notification(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_notification_unread_idx ON user_notification(user_id, created_at DESC) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS verification_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'unconfigured',
  provider_reference TEXT,
  document_kind TEXT CHECK (document_kind IS NULL OR document_kind IN ('passport','id_card','driver_license')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected','cancelled')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS verification_request_active_idx ON verification_request(user_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS verification_request_user_idx ON verification_request(user_id, created_at DESC);

ALTER TABLE deal ADD COLUMN IF NOT EXISTS dispute_previous_status TEXT;

CREATE TABLE IF NOT EXISTS deal_dispute (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deal(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  reason_code TEXT NOT NULL CHECK (reason_code IN ('cargo_damaged','cargo_missing','delivery_not_received','wrong_cargo','participant_unavailable','other')),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 10 AND 3000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','resolved_sender','resolved_driver','closed')),
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS deal_dispute_active_idx ON deal_dispute(deal_id) WHERE status IN ('open','under_review');
CREATE INDEX IF NOT EXISTS deal_dispute_deal_idx ON deal_dispute(deal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS dispute_evidence (
  id BIGSERIAL PRIMARY KEY,
  dispute_id UUID NOT NULL REFERENCES deal_dispute(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL DEFAULT 'note' CHECK (kind IN ('note','photo','document','system')),
  text_content TEXT CHECK (text_content IS NULL OR char_length(text_content) <= 5000),
  object_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (text_content IS NOT NULL OR object_key IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS dispute_evidence_dispute_idx ON dispute_evidence(dispute_id, created_at ASC);
