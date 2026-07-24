-- Adiciona saldo manualmente na carteira de um usuário no ambiente dev.
--
-- Como usar:
-- 1. Altere o email e o valor abaixo.
-- 2. Rode no banco de dados dev (DBeaver, psql, console da Vercel, etc.).
--
-- Exemplo de execução via psql:
-- psql "<DATABASE_URL_DA_DEV>" -f scripts/credit-wallet-dev.sql

DO $$
DECLARE
  v_user_id UUID;
  v_amount_cents INTEGER := 5000;  -- R$ 50,00 (altere aqui)
  v_idempotency_key TEXT := 'manual-credit-' || extract(epoch from now())::bigint;
BEGIN
  -- Busca o usuário pelo email
  SELECT id INTO v_user_id
  FROM users
  WHERE email = lower(trim('usuario@email.com'));  -- ALTERE O EMAIL

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  -- Insere o crédito no ledger
  INSERT INTO wallet_ledger (
    user_id,
    amount_cents,
    type,
    status,
    idempotency_key,
    balance_after,
    metadata,
    account
  ) VALUES (
    v_user_id,
    v_amount_cents,
    'adjustment',
    'settled',
    v_idempotency_key,
    COALESCE((SELECT balance_cents FROM users WHERE id = v_user_id), 0) + v_amount_cents,
    '{"reason": "Crédito manual para testes em dev"}'::jsonb,
    'wallet'
  );

  -- Atualiza o saldo do usuário
  UPDATE users
  SET balance_cents = COALESCE(balance_cents, 0) + v_amount_cents,
      updated_at = now()
  WHERE id = v_user_id;

  RAISE NOTICE 'Crédito de R$ % adicionado para o usuário %', (v_amount_cents / 100.0), v_user_id;
END $$;
