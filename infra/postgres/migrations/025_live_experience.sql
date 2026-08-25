-- v1.3.9 live experience: realtime invalidation, push outbox, notification archive.
ALTER TABLE user_notification ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS user_notification_active_idx ON user_notification(user_id,created_at DESC) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS push_device (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK(platform IN ('android','ios','unknown')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_device_user_idx ON push_device(user_id,enabled);

CREATE TABLE IF NOT EXISTS push_delivery_outbox (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  notification_id BIGINT REFERENCES user_notification(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INT NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_delivery_outbox_pending_idx ON push_delivery_outbox(available_at,id) WHERE delivered_at IS NULL;

CREATE TABLE IF NOT EXISTS live_signal (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES app_user(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_signal_user_idx ON live_signal(user_id,id);
CREATE INDEX IF NOT EXISTS live_signal_global_idx ON live_signal(id) WHERE user_id IS NULL;

CREATE OR REPLACE FUNCTION cg_live_cargo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF TG_OP='DELETE' THEN INSERT INTO live_signal(user_id,topic,entity_id) VALUES(NULL,'cargo',OLD.id); RETURN OLD; ELSE INSERT INTO live_signal(user_id,topic,entity_id) VALUES(NULL,'cargo',NEW.id); RETURN NEW; END IF; END $$;
DROP TRIGGER IF EXISTS cg_live_cargo_trg ON cargo;
CREATE TRIGGER cg_live_cargo_trg AFTER INSERT OR UPDATE OR DELETE ON cargo FOR EACH ROW EXECUTE FUNCTION cg_live_cargo();

CREATE OR REPLACE FUNCTION cg_live_trip() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF TG_OP='DELETE' THEN INSERT INTO live_signal(user_id,topic,entity_id) VALUES(NULL,'trip',OLD.id); RETURN OLD; ELSE INSERT INTO live_signal(user_id,topic,entity_id) VALUES(NULL,'trip',NEW.id); RETURN NEW; END IF; END $$;
DROP TRIGGER IF EXISTS cg_live_trip_trg ON trip;
CREATE TRIGGER cg_live_trip_trg AFTER INSERT OR UPDATE OR DELETE ON trip FOR EACH ROW EXECUTE FUNCTION cg_live_trip();

CREATE OR REPLACE FUNCTION cg_live_deal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN INSERT INTO live_signal(user_id,topic,entity_id) VALUES(NEW.sender_id,'deals',NEW.id),(NEW.driver_id,'deals',NEW.id); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS cg_live_deal_trg ON deal;
CREATE TRIGGER cg_live_deal_trg AFTER INSERT OR UPDATE ON deal FOR EACH ROW EXECUTE FUNCTION cg_live_deal();

CREATE OR REPLACE FUNCTION cg_live_message() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d record; BEGIN SELECT deal.id,deal.sender_id,deal.driver_id INTO d FROM deal_conversation dc JOIN deal ON deal.id=dc.deal_id WHERE dc.id=NEW.conversation_id; IF d.id IS NOT NULL THEN INSERT INTO live_signal(user_id,topic,entity_id) VALUES(d.sender_id,'chats',d.id),(d.driver_id,'chats',d.id); END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS cg_live_message_trg ON deal_message;
CREATE TRIGGER cg_live_message_trg AFTER INSERT ON deal_message FOR EACH ROW EXECUTE FUNCTION cg_live_message();

CREATE OR REPLACE FUNCTION cg_live_notification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN INSERT INTO live_signal(user_id,topic,entity_id) VALUES(NEW.user_id,'notifications',NEW.entity_id); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS cg_live_notification_trg ON user_notification;
CREATE TRIGGER cg_live_notification_trg AFTER INSERT OR UPDATE ON user_notification FOR EACH ROW EXECUTE FUNCTION cg_live_notification();

CREATE OR REPLACE FUNCTION cg_live_dispute() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d record; BEGIN SELECT sender_id,driver_id INTO d FROM deal WHERE id=NEW.deal_id; INSERT INTO live_signal(user_id,topic,entity_id) VALUES(d.sender_id,'disputes',NEW.deal_id),(d.driver_id,'disputes',NEW.deal_id),(NULL,'staff',NEW.deal_id); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS cg_live_dispute_trg ON deal_dispute;
CREATE TRIGGER cg_live_dispute_trg AFTER INSERT OR UPDATE ON deal_dispute FOR EACH ROW EXECUTE FUNCTION cg_live_dispute();

CREATE OR REPLACE FUNCTION cg_live_staff_generic() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN INSERT INTO live_signal(user_id,topic,entity_id) VALUES(NULL,'staff',NEW.id); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS cg_live_verification_review_trg ON verification_review_case;
CREATE TRIGGER cg_live_verification_review_trg AFTER INSERT OR UPDATE ON verification_review_case FOR EACH ROW EXECUTE FUNCTION cg_live_staff_generic();
DROP TRIGGER IF EXISTS cg_live_payout_trg ON payout;
CREATE TRIGGER cg_live_payout_trg AFTER INSERT OR UPDATE ON payout FOR EACH ROW EXECUTE FUNCTION cg_live_staff_generic();
