-- Webhook Cartwave: campos extras + log idempotente
ALTER TABLE affiliate_withdrawal_requests
  ADD COLUMN IF NOT EXISTS cartwave_end_to_end text,
  ADD COLUMN IF NOT EXISTS cartwave_webhook_last jsonb;

CREATE TABLE IF NOT EXISTS cartwave_webhook_events (
  id bigserial PRIMARY KEY,
  dedupe_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  withdrawal_id uuid REFERENCES affiliate_withdrawal_requests(id) ON DELETE SET NULL,
  payload jsonb NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cartwave_webhook_events_withdrawal_idx
  ON cartwave_webhook_events (withdrawal_id, created_at DESC);
