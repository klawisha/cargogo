BEGIN;
CREATE TABLE IF NOT EXISTS carrier_profile (
  user_id uuid PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'casual' CHECK (mode IN ('casual','professional')),
  professional_status text NOT NULL DEFAULT 'not_requested' CHECK (professional_status IN ('not_requested','pending','verified','rejected')),
  business_name text,
  business_registration_ref text,
  professional_note text,
  professional_reviewed_at timestamptz,
  professional_reviewed_by uuid REFERENCES app_user(id),
  accepted_casual_policy_at timestamptz,
  policy_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE trip ADD COLUMN IF NOT EXISTS carrier_mode_snapshot text CHECK (carrier_mode_snapshot IN ('casual','professional'));
ALTER TABLE trip ADD COLUMN IF NOT EXISTS casual_cost_cap_minor bigint;
ALTER TABLE trip ADD COLUMN IF NOT EXISTS casual_policy_version integer;
ALTER TABLE cargo_offer ADD COLUMN IF NOT EXISTS carrier_mode_snapshot text CHECK (carrier_mode_snapshot IN ('casual','professional'));
ALTER TABLE deal ADD COLUMN IF NOT EXISTS carrier_mode_snapshot text CHECK (carrier_mode_snapshot IN ('casual','professional'));
CREATE INDEX IF NOT EXISTS idx_carrier_profile_professional_status ON carrier_profile(professional_status) WHERE mode='professional';
COMMIT;
