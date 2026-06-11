-- Colunas Cartwave em solicitações de saque
ALTER TABLE affiliate_withdrawal_requests
  ADD COLUMN IF NOT EXISTS cartwave_transaction_id bigint,
  ADD COLUMN IF NOT EXISTS cartwave_status text,
  ADD COLUMN IF NOT EXISTS cartwave_response jsonb,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_note text;

CREATE INDEX IF NOT EXISTS affiliate_withdrawal_requests_status_created_idx
  ON affiliate_withdrawal_requests (status, created_at DESC);
