-- CargoGo v1.2.1 manual verification pipeline.
-- Raw documents live in a private S3-compatible bucket; PostgreSQL stores metadata only.

ALTER TABLE app_user ADD COLUMN IF NOT EXISTS staff_role TEXT;
ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_staff_role_check;
ALTER TABLE app_user ADD CONSTRAINT app_user_staff_role_check CHECK (staff_role IS NULL OR staff_role IN ('verification_reviewer','admin'));
CREATE INDEX IF NOT EXISTS app_user_staff_role_idx ON app_user(staff_role) WHERE staff_role IS NOT NULL;

CREATE TABLE IF NOT EXISTS verification_document (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('identity','driver_license','vehicle')),
  subject_id UUID,
  document_kind TEXT NOT NULL CHECK (document_kind IN (
    'identity_front','identity_back','selfie',
    'driver_license_front','driver_license_back',
    'vehicle_registration_front','vehicle_registration_back','vehicle_front','vehicle_rear','vehicle_left','vehicle_right','insurance'
  )),
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','application/pdf')),
  expected_size_bytes BIGINT NOT NULL CHECK (expected_size_bytes BETWEEN 1 AND 10485760),
  actual_size_bytes BIGINT,
  upload_status TEXT NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending','uploaded','rejected','deleted')),
  validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending','validated','rejected')),
  rejection_reason TEXT,
  confirmed_at TIMESTAMPTZ,
  retention_until TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((subject_type='vehicle' AND subject_id IS NOT NULL) OR (subject_type<>'vehicle' AND subject_id IS NULL))
);
CREATE INDEX IF NOT EXISTS verification_document_owner_idx ON verification_document(owner_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS verification_document_subject_idx ON verification_document(subject_type,subject_id,created_at DESC);
CREATE INDEX IF NOT EXISTS verification_document_retention_idx ON verification_document(retention_until) WHERE deleted_at IS NULL AND retention_until IS NOT NULL;

CREATE TABLE IF NOT EXISTS verification_review_case (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('identity','driver_license','vehicle')),
  subject_id UUID,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','in_review','resolved')),
  priority SMALLINT NOT NULL DEFAULT 100 CHECK (priority BETWEEN 1 AND 1000),
  assigned_to UUID REFERENCES app_user(id) ON DELETE SET NULL,
  decision TEXT CHECK (decision IS NULL OR decision IN ('verified','rejected','needs_resubmission')),
  decision_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  review_started_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((subject_type='vehicle' AND subject_id IS NOT NULL) OR (subject_type<>'vehicle' AND subject_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS verification_review_case_active_uq ON verification_review_case(owner_user_id,subject_type,COALESCE(subject_id,'00000000-0000-0000-0000-000000000000'::uuid)) WHERE status IN ('queued','in_review');
CREATE INDEX IF NOT EXISTS verification_review_queue_idx ON verification_review_case(status,priority,submitted_at);

CREATE TABLE IF NOT EXISTS verification_document_access_log (
  id BIGSERIAL PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES verification_document(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  review_case_id UUID REFERENCES verification_review_case(id) ON DELETE SET NULL,
  purpose TEXT NOT NULL CHECK (char_length(purpose) BETWEEN 3 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_document_access_actor_idx ON verification_document_access_log(actor_user_id,created_at DESC);
