-- CargoGo v1.7.0: contact recovery, vehicle operating economics, accounting ledger.
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS backup_phone_e164 TEXT;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS backup_phone_verified_at TIMESTAMPTZ;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS backup_email TEXT;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS backup_email_verified_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS app_user_email_lower_uq ON app_user(lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS app_user_backup_phone_uq ON app_user(backup_phone_e164) WHERE backup_phone_e164 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS app_user_backup_email_uq ON app_user(lower(backup_email)) WHERE backup_email IS NOT NULL;

CREATE TABLE IF NOT EXISTS contact_verification_challenge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('primary_phone','primary_email','backup_email','backup_phone')),
  value TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contact_verification_user_idx ON contact_verification_challenge(user_id,kind,created_at DESC);

ALTER TABLE vehicle ADD COLUMN IF NOT EXISTS fuel_type TEXT;
ALTER TABLE vehicle DROP CONSTRAINT IF EXISTS vehicle_fuel_type_check;
ALTER TABLE vehicle ADD CONSTRAINT vehicle_fuel_type_check CHECK (fuel_type IS NULL OR fuel_type IN ('petrol','diesel','lpg','petrol_lpg','hybrid','plug_in_hybrid','electric'));
ALTER TABLE vehicle ADD COLUMN IF NOT EXISTS engine_displacement_cc INTEGER CHECK (engine_displacement_cc IS NULL OR engine_displacement_cc BETWEEN 500 AND 10000);
ALTER TABLE vehicle ADD COLUMN IF NOT EXISTS curb_weight_kg NUMERIC(8,2) CHECK (curb_weight_kg IS NULL OR curb_weight_kg > 0);
ALTER TABLE vehicle ADD COLUMN IF NOT EXISTS gross_weight_kg NUMERIC(8,2) CHECK (gross_weight_kg IS NULL OR gross_weight_kg > 0);
ALTER TABLE vehicle ADD COLUMN IF NOT EXISTS avg_consumption_per_100 NUMERIC(6,2) CHECK (avg_consumption_per_100 IS NULL OR avg_consumption_per_100 > 0);
ALTER TABLE vehicle ADD COLUMN IF NOT EXISTS energy_consumption_kwh_100 NUMERIC(6,2) CHECK (energy_consumption_kwh_100 IS NULL OR energy_consumption_kwh_100 > 0);
ALTER TABLE trip ADD COLUMN IF NOT EXISTS casual_cost_breakdown JSONB;

CREATE TABLE IF NOT EXISTS operating_expense (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL CHECK (category IN ('infrastructure','maps','payments','developer_accounts','software','marketing','legal_accounting','equipment','refund_loss','other')),
  description TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL DEFAULT 'UAH' CHECK (currency IN ('UAH','USD','EUR')),
  reference TEXT,
  created_by UUID REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS operating_expense_date_idx ON operating_expense(incurred_on DESC,created_at DESC);
