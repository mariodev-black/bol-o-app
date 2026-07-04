-- Carteira (wallet) — livro-razão imutável como fonte da verdade do saldo.
-- Aditivo e idempotente: pode rodar mais de uma vez sem efeito colateral.
--
-- Princípio: users.balance_cents passa a ser um CACHE derivado do ledger.
-- Invariante: SUM(wallet_ledger.amount_cents) por usuário == users.balance_cents.

CREATE TABLE IF NOT EXISTS wallet_ledger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid   NOT NULL REFERENCES users(id),
  -- positivo = crédito (depósito/prêmio/estorno), negativo = débito (compra/saque)
  amount_cents    bigint NOT NULL,
  -- opening_balance | deposit_pix | purchase | prize | withdrawal | refund | adjustment
  type            text   NOT NULL,
  status          text   NOT NULL DEFAULT 'settled',
  -- vínculo opcional com a transação de pagamento que originou o movimento
  transaction_id  uuid   NULL REFERENCES transactions(id),
  -- chave única que impede crédito/débito duplicado (ex.: retry de webhook)
  idempotency_key text   NOT NULL,
  -- saldo do usuário logo após este movimento (trilha de auditoria)
  balance_after   bigint NOT NULL,
  metadata        jsonb  NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallet_ledger_idempotency_key_uk UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS wallet_ledger_user_created_idx
  ON wallet_ledger (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS wallet_ledger_transaction_idx
  ON wallet_ledger (transaction_id)
  WHERE transaction_id IS NOT NULL;

-- Backfill: cria o saldo de abertura a partir do balance_cents já existente,
-- para o ledger "bater" com o saldo atual desde o dia 1 (ninguém perde valor).
-- idempotency_key = 'opening:<user_id>' garante que rodar de novo não duplica.
INSERT INTO wallet_ledger (user_id, amount_cents, type, status, idempotency_key, balance_after, metadata)
SELECT
  u.id,
  COALESCE(u.balance_cents, 0)::bigint,
  'opening_balance',
  'settled',
  'opening:' || u.id::text,
  COALESCE(u.balance_cents, 0)::bigint,
  jsonb_build_object('source', 'backfill', 'migrated_at', now())
FROM users u
WHERE COALESCE(u.balance_cents, 0) <> 0
ON CONFLICT (idempotency_key) DO NOTHING;
