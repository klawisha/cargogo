ALTER TABLE user_session ADD COLUMN IF NOT EXISTS previous_refresh_token_hash CHAR(64);
CREATE INDEX IF NOT EXISTS user_session_previous_refresh_idx ON user_session(previous_refresh_token_hash) WHERE revoked_at IS NULL;
