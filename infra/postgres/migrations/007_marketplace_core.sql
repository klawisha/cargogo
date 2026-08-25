CREATE TABLE IF NOT EXISTS cargo_offer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_id UUID NOT NULL REFERENCES cargo(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
  cargo_owner_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 100000000),
  currency CHAR(3) NOT NULL DEFAULT 'UAH',
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','withdrawn','expired','superseded')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (cargo_owner_id <> driver_id)
);
CREATE INDEX IF NOT EXISTS cargo_offer_cargo_status_idx ON cargo_offer(cargo_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS cargo_offer_driver_status_idx ON cargo_offer(driver_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS cargo_offer_trip_idx ON cargo_offer(trip_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS cargo_offer_one_pending_idx
  ON cargo_offer(cargo_id, trip_id, driver_id)
  WHERE status='pending';

CREATE TABLE IF NOT EXISTS deal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_id UUID NOT NULL REFERENCES cargo(id),
  trip_id UUID NOT NULL REFERENCES trip(id),
  offer_id UUID NOT NULL UNIQUE REFERENCES cargo_offer(id),
  sender_id UUID NOT NULL REFERENCES app_user(id),
  driver_id UUID NOT NULL REFERENCES app_user(id),
  agreed_amount_minor INTEGER NOT NULL CHECK (agreed_amount_minor > 0),
  currency CHAR(3) NOT NULL DEFAULT 'UAH',
  status TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK (status IN (
    'awaiting_payment','payment_secured','awaiting_pickup','picked_up','in_transit','arrived','delivered','completed','cancelled','disputed','refunded'
  )),
  payment_status TEXT NOT NULL DEFAULT 'not_started' CHECK (payment_status IN ('not_started','pending','secured','failed','refunded','released')),
  pickup_code_hash CHAR(64),
  delivery_code_hash CHAR(64),
  cancelled_by UUID REFERENCES app_user(id),
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (sender_id <> driver_id)
);
CREATE INDEX IF NOT EXISTS deal_sender_status_idx ON deal(sender_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS deal_driver_status_idx ON deal(driver_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS deal_cargo_idx ON deal(cargo_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS deal_one_live_per_cargo_idx
  ON deal(cargo_id)
  WHERE status NOT IN ('cancelled','refunded','completed');

CREATE TABLE IF NOT EXISTS deal_event (
  id BIGSERIAL PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES deal(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deal_event_deal_idx ON deal_event(deal_id, created_at ASC, id ASC);

CREATE TABLE IF NOT EXISTS deal_conversation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL UNIQUE REFERENCES deal(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deal_message (
  id BIGSERIAL PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES deal_conversation(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES app_user(id),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deal_message_conversation_idx ON deal_message(conversation_id, id DESC);
CREATE INDEX IF NOT EXISTS deal_message_sender_idx ON deal_message(sender_id, created_at DESC);
