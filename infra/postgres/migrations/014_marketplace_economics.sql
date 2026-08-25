ALTER TABLE deal ADD COLUMN IF NOT EXISTS target_net_margin_minor bigint NOT NULL DEFAULT 0 CHECK (target_net_margin_minor >= 0);
ALTER TABLE deal ADD COLUMN IF NOT EXISTS estimated_acquiring_fee_minor bigint NOT NULL DEFAULT 0 CHECK (estimated_acquiring_fee_minor >= 0);
ALTER TABLE deal ADD COLUMN IF NOT EXISTS estimated_payout_fee_minor bigint NOT NULL DEFAULT 0 CHECK (estimated_payout_fee_minor >= 0);
ALTER TABLE deal ADD COLUMN IF NOT EXISTS actual_acquiring_fee_minor bigint CHECK (actual_acquiring_fee_minor >= 0);
ALTER TABLE deal ADD COLUMN IF NOT EXISTS actual_payout_fee_minor bigint CHECK (actual_payout_fee_minor >= 0);
ALTER TABLE deal ADD COLUMN IF NOT EXISTS platform_net_revenue_minor bigint;
ALTER TABLE deal ADD COLUMN IF NOT EXISTS actual_net_margin_bps integer;
ALTER TABLE deal ADD COLUMN IF NOT EXISTS fee_policy_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE payout ADD COLUMN IF NOT EXISTS provider_fee_minor bigint CHECK (provider_fee_minor >= 0);

ALTER TABLE finance_ledger_entry DROP CONSTRAINT IF EXISTS finance_ledger_entry_entry_type_check;
ALTER TABLE finance_ledger_entry DROP CONSTRAINT IF EXISTS finance_ledger_entry_amount_minor_check;
ALTER TABLE finance_ledger_entry ADD CONSTRAINT finance_ledger_entry_amount_policy_check CHECK (entry_type='platform_net_revenue' OR amount_minor >= 0);
ALTER TABLE finance_ledger_entry ADD CONSTRAINT finance_ledger_entry_entry_type_check CHECK (entry_type IN (
  'customer_hold','customer_capture','customer_void','customer_refund',
  'platform_fee','carrier_payable','carrier_payout',
  'acquiring_fee','payout_fee','platform_net_revenue'
));

-- Existing deals keep their old fee split. Populate descriptive economics columns without changing agreed economics.
UPDATE deal
SET fee_policy_snapshot = CASE WHEN fee_policy_snapshot='{}'::jsonb THEN jsonb_build_object('version',0,'source','legacy_pre_1_1') ELSE fee_policy_snapshot END
WHERE agreed_amount_minor > 0;

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
     OR OLD.fee_policy_snapshot IS DISTINCT FROM NEW.fee_policy_snapshot THEN
    RAISE EXCEPTION 'deal financial snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_deal_financial_snapshot ON deal;
CREATE TRIGGER trg_protect_deal_financial_snapshot
BEFORE UPDATE ON deal
FOR EACH ROW EXECUTE FUNCTION protect_deal_financial_snapshot();
