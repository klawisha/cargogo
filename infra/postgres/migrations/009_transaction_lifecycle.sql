ALTER TABLE deal
  ADD COLUMN IF NOT EXISTS payment_secured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transit_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_attempts INTEGER NOT NULL DEFAULT 0 CHECK (pickup_attempts >= 0),
  ADD COLUMN IF NOT EXISTS delivery_attempts INTEGER NOT NULL DEFAULT 0 CHECK (delivery_attempts >= 0),
  ADD COLUMN IF NOT EXISTS pickup_locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_code_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS delivery_code_ciphertext TEXT;

CREATE TABLE IF NOT EXISTS deal_review (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deal(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (reviewer_id <> reviewee_id),
  UNIQUE (deal_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS deal_review_reviewee_idx ON deal_review(reviewee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS deal_review_deal_idx ON deal_review(deal_id, created_at ASC);
