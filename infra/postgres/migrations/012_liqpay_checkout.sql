ALTER TABLE deal ADD COLUMN IF NOT EXISTS payment_provider text;
ALTER TABLE deal ADD COLUMN IF NOT EXISTS payment_reference text;

CREATE TABLE IF NOT EXISTS payment_attempt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES deal(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_order_id text NOT NULL UNIQUE,
  provider_payment_id text,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL DEFAULT 'UAH',
  status text NOT NULL DEFAULT 'prepared',
  checkout_token_hash text NOT NULL,
  checkout_token_expires_at timestamptz NOT NULL,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (deal_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_payment_attempt_deal ON payment_attempt(deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_attempt_status ON payment_attempt(status, updated_at DESC);
