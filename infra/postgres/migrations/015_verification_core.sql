-- CargoGo v1.2.0: identity, driver-license and vehicle verification core.
-- Raw document images/numbers are deliberately NOT stored in these tables.
-- Production providers should receive documents directly and return a provider reference/result.

CREATE TABLE IF NOT EXISTS identity_verification_profile (
  user_id UUID PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','draft','submitted','under_review','verified','rejected','needs_resubmission','expired','suspended')),
  document_kind TEXT CHECK (document_kind IS NULL OR document_kind IN ('passport','id_card')),
  document_country CHAR(2),
  document_last4 VARCHAR(4),
  provider TEXT NOT NULL DEFAULT 'none',
  provider_reference TEXT,
  rejection_code TEXT,
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (document_last4 IS NULL OR document_last4 ~ '^[A-Za-z0-9]{2,4}$')
);
CREATE INDEX IF NOT EXISTS identity_verification_profile_status_idx ON identity_verification_profile(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS driver_license_verification (
  user_id UUID PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','draft','submitted','under_review','verified','rejected','needs_resubmission','expired','suspended')),
  country_code CHAR(2),
  license_last4 VARCHAR(4),
  categories TEXT[] NOT NULL DEFAULT '{}'::text[],
  provider TEXT NOT NULL DEFAULT 'none',
  provider_reference TEXT,
  rejection_code TEXT,
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (license_last4 IS NULL OR license_last4 ~ '^[A-Za-z0-9]{2,4}$')
);
CREATE INDEX IF NOT EXISTS driver_license_verification_status_idx ON driver_license_verification(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS vehicle_verification (
  vehicle_id UUID PRIMARY KEY REFERENCES vehicle(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','draft','submitted','under_review','verified','rejected','needs_resubmission','expired','suspended')),
  registration_country CHAR(2),
  registration_number_masked TEXT,
  vin_last6 VARCHAR(6),
  make TEXT,
  model TEXT,
  year SMALLINT CHECK (year IS NULL OR year BETWEEN 1950 AND 2100),
  color TEXT,
  registration_document_status TEXT NOT NULL DEFAULT 'not_started' CHECK (registration_document_status IN ('not_started','submitted','verified','rejected','expired')),
  insurance_status TEXT NOT NULL DEFAULT 'not_started' CHECK (insurance_status IN ('not_started','submitted','verified','rejected','expired','not_required')),
  provider TEXT NOT NULL DEFAULT 'manual',
  provider_reference TEXT,
  rejection_code TEXT,
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id, vehicle_id),
  CHECK (vin_last6 IS NULL OR vin_last6 ~ '^[A-HJ-NPR-Z0-9]{4,6}$')
);
CREATE INDEX IF NOT EXISTS vehicle_verification_owner_idx ON vehicle_verification(owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS vehicle_verification_status_idx ON vehicle_verification(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS verification_event (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('identity','driver_license','vehicle')),
  subject_id UUID,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  provider TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_event_user_idx ON verification_event(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS verification_event_subject_idx ON verification_event(subject_type, subject_id, created_at DESC);

-- Keep the existing public compatibility fields in sync with the richer state machine.
-- Detailed status lives in the v2 verification tables; app_user/vehicle stay four-state for old clients.
