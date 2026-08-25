ALTER TABLE deal ADD COLUMN IF NOT EXISTS platform_fee_minor bigint NOT NULL DEFAULT 0 CHECK (platform_fee_minor >= 0);
ALTER TABLE deal ADD COLUMN IF NOT EXISTS carrier_amount_minor bigint NOT NULL DEFAULT 0 CHECK (carrier_amount_minor >= 0);
ALTER TABLE deal ADD COLUMN IF NOT EXISTS settlement_status text NOT NULL DEFAULT 'not_started';
ALTER TABLE deal ADD COLUMN IF NOT EXISTS captured_at timestamptz;
ALTER TABLE deal ADD COLUMN IF NOT EXISTS payout_completed_at timestamptz;

CREATE TABLE IF NOT EXISTS payout_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'bank_transfer',
  method_type text NOT NULL DEFAULT 'iban' CHECK (method_type IN ('iban')),
  holder_name_ciphertext text NOT NULL,
  iban_ciphertext text NOT NULL,
  iban_last4 text NOT NULL CHECK (char_length(iban_last4)=4),
  country_code text NOT NULL DEFAULT 'UA',
  currency text NOT NULL DEFAULT 'UAH',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  provider_recipient_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_payout_account_per_user ON payout_account(user_id) WHERE status='active';

CREATE TABLE IF NOT EXISTS payout (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL UNIQUE REFERENCES deal(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  payout_account_id uuid NOT NULL REFERENCES payout_account(id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL DEFAULT 'UAH',
  provider text NOT NULL,
  provider_reference text UNIQUE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','paid','failed','manual_review','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_payout_status ON payout(status, created_at);

CREATE TABLE IF NOT EXISTS finance_ledger_entry (
  id bigserial PRIMARY KEY,
  deal_id uuid NOT NULL REFERENCES deal(id) ON DELETE RESTRICT,
  payout_id uuid REFERENCES payout(id) ON DELETE SET NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('customer_hold','customer_capture','customer_void','customer_refund','platform_fee','carrier_payable','carrier_payout')),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL DEFAULT 'UAH',
  provider text,
  provider_reference text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finance_ledger_deal ON finance_ledger_entry(deal_id,id);

-- Backfill fee snapshot for pre-1.0 deals. Production deals snapshot this at offer acceptance.
UPDATE deal
SET platform_fee_minor = round(agreed_amount_minor * 0.08)::bigint,
    carrier_amount_minor = agreed_amount_minor - round(agreed_amount_minor * 0.08)::bigint
WHERE platform_fee_minor = 0 AND carrier_amount_minor = 0 AND agreed_amount_minor > 0;
ALTER TABLE deal DROP CONSTRAINT IF EXISTS deal_payment_status_check;
ALTER TABLE deal ADD CONSTRAINT deal_payment_status_check CHECK (payment_status IN ('not_started','pending','secured','captured','failed','refunded','released'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_ledger_deal_entry ON finance_ledger_entry(deal_id,entry_type);
ALTER TABLE deal ADD COLUMN IF NOT EXISTS payout_account_id uuid REFERENCES payout_account(id) ON DELETE RESTRICT;
CREATE OR REPLACE FUNCTION protect_deal_financial_snapshot() RETURNS trigger AS $$
BEGIN
  IF OLD.agreed_amount_minor IS DISTINCT FROM NEW.agreed_amount_minor
     OR OLD.currency IS DISTINCT FROM NEW.currency
     OR OLD.platform_fee_minor IS DISTINCT FROM NEW.platform_fee_minor
     OR OLD.carrier_amount_minor IS DISTINCT FROM NEW.carrier_amount_minor
     OR OLD.payout_account_id IS DISTINCT FROM NEW.payout_account_id THEN
    RAISE EXCEPTION 'deal financial snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_protect_deal_financial_snapshot ON deal;
CREATE TRIGGER trg_protect_deal_financial_snapshot BEFORE UPDATE ON deal FOR EACH ROW EXECUTE FUNCTION protect_deal_financial_snapshot();
