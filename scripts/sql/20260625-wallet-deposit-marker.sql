-- Depósito de saldo na carteira reaproveita a tabela `transactions` + webhook Skale.
-- Um depósito de carteira não tem ticket: marcamos com `purpose='wallet_deposit'`
-- e permitimos ticket_id/ticket_type nulos. Tudo aditivo (relaxa NOT NULL; nenhuma
-- linha existente é alterada — todas seguem com purpose='purchase' por default).

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'purchase';

-- Relaxar NOT NULL (no-op se já forem nuláveis). Compras continuam preenchendo ambos.
ALTER TABLE transactions ALTER COLUMN ticket_id DROP NOT NULL;
ALTER TABLE transactions ALTER COLUMN ticket_type DROP NOT NULL;

CREATE INDEX IF NOT EXISTS transactions_wallet_deposit_idx
  ON transactions (user_id, created_at DESC)
  WHERE purpose = 'wallet_deposit';
