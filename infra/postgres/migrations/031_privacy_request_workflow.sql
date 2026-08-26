-- v1.6.3 structured privacy-rights workflow.
ALTER TABLE privacy_request
  ADD COLUMN IF NOT EXISTS request_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS privacy_request_type_status_idx
  ON privacy_request(request_type,status,created_at ASC);
