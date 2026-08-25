-- Optional sender-declared cargo value for dispute context only.
-- It does NOT affect price, marketplace economics, insurance or automatic compensation.
ALTER TABLE cargo ADD COLUMN IF NOT EXISTS declared_value_minor bigint;
ALTER TABLE cargo ADD COLUMN IF NOT EXISTS declared_value_currency text;

ALTER TABLE cargo DROP CONSTRAINT IF EXISTS cargo_declared_value_policy_check;
ALTER TABLE cargo ADD CONSTRAINT cargo_declared_value_policy_check CHECK (
  (declared_value_minor IS NULL AND declared_value_currency IS NULL)
  OR
  (declared_value_minor IS NOT NULL AND declared_value_minor >= 0 AND declared_value_minor <= 10000000000 AND declared_value_currency = 'UAH')
);

-- Freeze the informational value at offer acceptance so later cargo edits cannot rewrite dispute context.
ALTER TABLE deal ADD COLUMN IF NOT EXISTS declared_value_minor_snapshot bigint;
ALTER TABLE deal ADD COLUMN IF NOT EXISTS declared_value_currency_snapshot text;

ALTER TABLE deal DROP CONSTRAINT IF EXISTS deal_declared_value_snapshot_policy_check;
ALTER TABLE deal ADD CONSTRAINT deal_declared_value_snapshot_policy_check CHECK (
  (declared_value_minor_snapshot IS NULL AND declared_value_currency_snapshot IS NULL)
  OR
  (declared_value_minor_snapshot IS NOT NULL AND declared_value_minor_snapshot >= 0 AND declared_value_minor_snapshot <= 10000000000 AND declared_value_currency_snapshot = 'UAH')
);

-- Existing active/finished deals receive the value that exists on their cargo at migration time.
-- For historical deals this is best-effort metadata, not proof that the value was declared before acceptance.
UPDATE deal d
SET declared_value_minor_snapshot = c.declared_value_minor,
    declared_value_currency_snapshot = c.declared_value_currency
FROM cargo c
WHERE c.id = d.cargo_id
  AND d.declared_value_minor_snapshot IS NULL
  AND c.declared_value_minor IS NOT NULL;

-- Extend existing immutable deal snapshot protection.
CREATE OR REPLACE FUNCTION protect_deal_financial_snapshot() RETURNS trigger AS $$
BEGIN
  IF OLD.agreed_amount_minor IS DISTINCT FROM NEW.agreed_amount_minor
     OR OLD.currency IS DISTINCT FROM NEW.currency
     OR OLD.platform_fee_minor IS DISTINCT FROM NEW.platform_fee_minor
     OR OLD.carrier_amount_minor IS DISTINCT FROM NEW.carrier_amount_minor
     OR OLD.payout_account_id IS DISTINCT FROM NEW.payout_account_id
     OR OLD.target_net_margin_minor IS DISTINCT FROM NEW.target_net_margin_minor
     OR OLD.estimated_acquiring_fee_minor IS DISTINCT FROM NEW.estimated_acquiring_fee_minor
     OR OLD.estimated_payout_fee_minor IS DISTINCT FROM NEW.estimated_payout_fee_minor
     OR OLD.fee_policy_snapshot IS DISTINCT FROM NEW.fee_policy_snapshot
     OR OLD.declared_value_minor_snapshot IS DISTINCT FROM NEW.declared_value_minor_snapshot
     OR OLD.declared_value_currency_snapshot IS DISTINCT FROM NEW.declared_value_currency_snapshot THEN
    RAISE EXCEPTION 'deal financial snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
