-- Saque unificado grava balance_source = 'combined'.
-- Constraint antiga só aceitava affiliate|wallet.

ALTER TABLE affiliate_withdrawal_requests
  DROP CONSTRAINT IF EXISTS affiliate_withdrawal_requests_balance_source_check;

ALTER TABLE affiliate_withdrawal_requests
  ADD CONSTRAINT affiliate_withdrawal_requests_balance_source_check
  CHECK (
    balance_source = ANY (
      ARRAY[
        'affiliate'::text,
        'wallet'::text,
        'combined'::text
      ]
    )
  );
