-- CargoGo v1.3.7: unified staff reviewer role.
-- Existing specialized roles remain supported for backwards compatibility.
ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_staff_role_check;
ALTER TABLE app_user ADD CONSTRAINT app_user_staff_role_check
  CHECK (staff_role IS NULL OR staff_role IN ('reviewer','verification_reviewer','dispute_reviewer','admin'));
