-- v1.6.0 production-readiness: versioned legal acceptance, privacy requests and client error telemetry.
CREATE TABLE IF NOT EXISTS legal_acceptance (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  document_key TEXT NOT NULL,
  document_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(user_id, document_key, document_version)
);
CREATE INDEX IF NOT EXISTS legal_acceptance_user_idx ON legal_acceptance(user_id, accepted_at DESC);

CREATE TABLE IF NOT EXISTS privacy_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK(request_type IN ('access','correction','deletion','restriction','objection','consent_withdrawal')),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_review','completed','rejected')),
  note TEXT,
  reviewer_note TEXT,
  reviewed_by UUID REFERENCES app_user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS privacy_request_queue_idx ON privacy_request(status,created_at ASC);
CREATE INDEX IF NOT EXISTS privacy_request_user_idx ON privacy_request(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS client_error_event (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  session_id UUID REFERENCES user_session(id) ON DELETE SET NULL,
  app_version TEXT,
  platform TEXT,
  screen TEXT,
  error_name TEXT,
  message TEXT NOT NULL,
  stack TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_error_recent_idx ON client_error_event(created_at DESC);
CREATE INDEX IF NOT EXISTS client_error_user_idx ON client_error_event(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS release_gate_snapshot (
  id BIGSERIAL PRIMARY KEY,
  environment TEXT NOT NULL,
  app_version TEXT NOT NULL,
  result TEXT NOT NULL CHECK(result IN ('pass','warn','fail')),
  checks JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
