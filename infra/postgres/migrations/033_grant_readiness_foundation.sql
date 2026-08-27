-- CargoGo v1.8.0: self-hosted diagnostics used by reviewer Grant Readiness workspace.
ALTER TABLE client_error_event ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('info','warning','error','critical'));
ALTER TABLE client_error_event ADD COLUMN IF NOT EXISTS fingerprint TEXT;
ALTER TABLE client_error_event ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE client_error_event ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES app_user(id) ON DELETE SET NULL;
ALTER TABLE client_error_event ADD COLUMN IF NOT EXISTS resolution_note TEXT;
CREATE INDEX IF NOT EXISTS client_error_unresolved_idx ON client_error_event(resolved_at,created_at DESC);

CREATE TABLE IF NOT EXISTS server_diagnostic_event (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  session_id UUID REFERENCES user_session(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('warning','error','critical')),
  method TEXT,
  path TEXT,
  status_code INTEGER,
  error_name TEXT,
  message TEXT NOT NULL,
  stack TEXT,
  fingerprint TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES app_user(id) ON DELETE SET NULL,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS server_diagnostic_recent_idx ON server_diagnostic_event(created_at DESC);
CREATE INDEX IF NOT EXISTS server_diagnostic_unresolved_idx ON server_diagnostic_event(resolved_at,created_at DESC);
