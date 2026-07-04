-- Backfill rico do ledger: itemiza o histórico de PRÊMIOS no extrato da carteira.
-- Substitui o "Saldo inicial" genérico por: 1 linha 'prize' por prêmio histórico
-- (com a data real) + 1 linha de reconciliação com o que sobra (saques/ajustes antigos).
-- Atômico (multi-statement = 1 transação) e idempotente (re-rodável).
-- Invariante preservada: SUM(wallet_ledger.amount_cents) por usuário == users.balance_cents.

-- 1) Remove as linhas de abertura do backfill anterior (vamos reconstruir).
DELETE FROM wallet_ledger WHERE idempotency_key LIKE 'opening:%';

-- 2) Uma linha 'prize' por prêmio histórico pago (idempotente pela chave por transação).
INSERT INTO wallet_ledger
  (user_id, amount_cents, type, status, transaction_id, idempotency_key, balance_after, metadata, created_at)
SELECT
  t.user_id,
  t.amount_cents,
  'prize',
  'settled',
  t.id,
  'prize:legacy:' || t.id::text,
  0,
  jsonb_build_object('source', 'backfill_prize', 'externalRef', t.external_ref),
  t.created_at
FROM transactions t
WHERE t.provider = 'internal_prize' AND t.status IN ('paid', 'approved')
ON CONFLICT (idempotency_key) DO NOTHING;

-- 3) Reconciliação por usuário = saldo atual - soma dos prêmios itemizados.
--    Cobre o que não itemizamos (saques de carteira, estornos, ajustes antigos).
INSERT INTO wallet_ledger
  (user_id, amount_cents, type, status, idempotency_key, balance_after, metadata, created_at)
SELECT
  u.id,
  (COALESCE(u.balance_cents, 0) - COALESCE(p.prize_sum, 0))::bigint,
  CASE
    WHEN (COALESCE(u.balance_cents, 0) - COALESCE(p.prize_sum, 0)) >= 0 THEN 'opening_balance'
    ELSE 'adjustment'
  END,
  'settled',
  'opening:' || u.id::text,
  0,
  jsonb_build_object('source', 'backfill_reconcile'),
  COALESCE(p.first_prize, now()) - interval '1 second'
FROM users u
LEFT JOIN (
  SELECT user_id, sum(amount_cents) AS prize_sum, min(created_at) AS first_prize
  FROM wallet_ledger
  WHERE type = 'prize'
  GROUP BY user_id
) p ON p.user_id = u.id
WHERE (COALESCE(u.balance_cents, 0) - COALESCE(p.prize_sum, 0)) <> 0
ON CONFLICT (idempotency_key) DO NOTHING;

-- 4) Recalcula balance_after cumulativo (ordem cronológica) por usuário.
WITH ordered AS (
  SELECT
    id,
    sum(amount_cents) OVER (
      PARTITION BY user_id ORDER BY created_at, id
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running
  FROM wallet_ledger
)
UPDATE wallet_ledger w
SET balance_after = o.running
FROM ordered o
WHERE o.id = w.id;
