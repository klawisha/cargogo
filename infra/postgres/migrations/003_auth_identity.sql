ALTER TABLE app_user ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_verification_status_check;
ALTER TABLE app_user ADD CONSTRAINT app_user_verification_status_check CHECK (verification_status IN ('unverified','pending','verified','rejected'));

CREATE TABLE IF NOT EXISTS user_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  access_token_hash CHAR(64) NOT NULL UNIQUE,
  refresh_token_hash CHAR(64) NOT NULL UNIQUE,
  access_expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ NOT NULL,
  user_agent TEXT,
  last_ip INET,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rotated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_session_user_active_idx ON user_session(user_id, revoked_at, refresh_expires_at DESC);
CREATE INDEX IF NOT EXISTS user_session_access_hash_idx ON user_session(access_token_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS user_session_refresh_hash_idx ON user_session(refresh_token_hash) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS identity_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  provider TEXT,
  provider_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected','expired')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS identity_verification_user_idx ON identity_verification(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_event (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  session_id UUID REFERENCES user_session(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_event_actor_idx ON audit_event(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_event_entity_idx ON audit_event(entity_type, entity_id, created_at DESC);
