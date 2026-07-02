-- Unifica o saldo exibido ao usuário (carteira + afiliado), mantendo as 2
-- colunas no banco (users.balance_cents e users.affiliate_balance_cents).
-- O wallet_ledger ganha uma dimensão "account" para também registrar
-- movimentos do lado afiliado (comissão, saque, estorno) — o extrato passa a
-- mostrar tudo, e cada lado continua auditável separadamente.
-- Aditivo e idempotente.

ALTER TABLE wallet_ledger
  ADD COLUMN IF NOT EXISTS account text NOT NULL DEFAULT 'wallet';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wallet_ledger_account_check'
  ) THEN
    ALTER TABLE wallet_ledger
      ADD CONSTRAINT wallet_ledger_account_check CHECK (account IN ('wallet', 'affiliate'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS wallet_ledger_user_account_idx
  ON wallet_ledger (user_id, account, created_at DESC);

-- Saldo de abertura do lado afiliado: garante que o ledger bata com
-- affiliate_balance_cents desde já (histórico agregado, não itemizado —
-- comissões novas a partir de agora entram itemizadas como 'commission').
INSERT INTO wallet_ledger (user_id, amount_cents, type, status, idempotency_key, balance_after, account, metadata)
SELECT
  u.id,
  COALESCE(u.affiliate_balance_cents, 0)::bigint,
  'opening_balance',
  'settled',
  'opening:affiliate:' || u.id::text,
  COALESCE(u.affiliate_balance_cents, 0)::bigint,
  'affiliate',
  jsonb_build_object('source', 'backfill_affiliate', 'migrated_at', now())
FROM users u
WHERE COALESCE(u.affiliate_balance_cents, 0) <> 0
ON CONFLICT (idempotency_key) DO NOTHING;
