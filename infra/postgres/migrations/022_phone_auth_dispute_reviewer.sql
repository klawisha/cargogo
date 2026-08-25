-- CargoGo v1.3.6: phone-first auth and dedicated dispute reviewer role.
ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_staff_role_check;
ALTER TABLE app_user ADD CONSTRAINT app_user_staff_role_check
  CHECK (staff_role IS NULL OR staff_role IN ('verification_reviewer','dispute_reviewer','admin'));

ALTER TABLE app_user ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS app_user_phone_e164_uq ON app_user(phone_e164) WHERE phone_e164 IS NOT NULL;
