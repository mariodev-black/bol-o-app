-- =============================================================================
-- Bolão do Milhão — atualização completa do banco (PostgreSQL)
-- =============================================================================
-- Aplique em um banco que já tenha as tabelas core (ex.: users, referral_commissions).
-- É idempotente na maior parte: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / DO $$.
--
-- Ordem: (1) tabela de saques se ainda não existir  (2) admin / afiliados / saques
-- =============================================================================

-- -----------------------------------------------------------------------------
-- affiliate_withdrawal_requests — criação apenas se não existir
-- (ajuste tipos se o seu projeto já tiver esta tabela com outro layout)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS affiliate_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  pix_key_type text NOT NULL,
  pix_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  balance_source text NOT NULL DEFAULT 'affiliate',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS affiliate_withdrawal_requests_user_id_idx
  ON affiliate_withdrawal_requests (user_id);

CREATE INDEX IF NOT EXISTS affiliate_withdrawal_requests_status_idx
  ON affiliate_withdrawal_requests (status);

CREATE INDEX IF NOT EXISTS affiliate_withdrawal_requests_pending_idx
  ON affiliate_withdrawal_requests (status)
  WHERE status = 'pending';

-- Garantir coluna balance_source em bases antigas (antes de constraints abaixo)
ALTER TABLE affiliate_withdrawal_requests
  ADD COLUMN IF NOT EXISTS balance_source text NOT NULL DEFAULT 'affiliate';

-- -----------------------------------------------------------------------------
-- Trecho igual a db/admin-schema.sql — admin, saldos, comissões, saques
-- -----------------------------------------------------------------------------
-- Admin security schema.
-- Execute once in production before enabling /admin.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS admin_2fa_secret text,
  ADD COLUMN IF NOT EXISTS admin_2fa_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_2fa_enabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS affiliate_mode text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS influencer_cpa_bps integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS affiliate_balance_cents integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'super_admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_affiliate_mode_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_affiliate_mode_check CHECK (affiliate_mode IN ('standard', 'influencer'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_influencer_cpa_bps_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_influencer_cpa_bps_check CHECK (influencer_cpa_bps >= 0 AND influencer_cpa_bps <= 10000);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_balance_cents_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_balance_cents_check CHECK (balance_cents >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_affiliate_balance_cents_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_affiliate_balance_cents_check CHECK (affiliate_balance_cents >= 0);
  END IF;
END $$;

ALTER TABLE referral_commissions
  ADD COLUMN IF NOT EXISTS commission_model text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS cpa_bps integer,
  ADD COLUMN IF NOT EXISTS base_amount_cents integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'referral_commissions_model_check'
  ) THEN
    ALTER TABLE referral_commissions
      ADD CONSTRAINT referral_commissions_model_check CHECK (commission_model IN ('standard', 'influencer'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
CREATE INDEX IF NOT EXISTS users_affiliate_mode_idx ON users(affiliate_mode);

UPDATE users u
SET affiliate_balance_cents = GREATEST(
  0,
  COALESCE(earned.total_cents, 0)
  - COALESCE(pending.total_cents, 0)
  - COALESCE(done.total_cents, 0)
)
FROM (
  SELECT referrer_user_id, SUM(amount_cents)::integer AS total_cents
  FROM referral_commissions
  GROUP BY referrer_user_id
) earned
LEFT JOIN (
  SELECT user_id, SUM(amount_cents)::integer AS total_cents
  FROM affiliate_withdrawal_requests
  WHERE status = 'pending'
    AND COALESCE(balance_source, 'affiliate') = 'affiliate'
  GROUP BY user_id
) pending ON pending.user_id::text = earned.referrer_user_id::text
LEFT JOIN (
  SELECT user_id, SUM(amount_cents)::integer AS total_cents
  FROM affiliate_withdrawal_requests
  WHERE status IN ('approved', 'paid')
    AND COALESCE(balance_source, 'affiliate') = 'affiliate'
  GROUP BY user_id
) done ON done.user_id::text = earned.referrer_user_id::text
WHERE u.id::text = earned.referrer_user_id::text
  AND u.affiliate_balance_cents = 0;

-- Promote the first admin manually, then configure 2FA at /admin/2fa:
-- UPDATE users SET role = 'super_admin' WHERE lower(email) = lower('seu-email@dominio.com');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'affiliate_withdrawal_requests_balance_source_check'
  ) THEN
    ALTER TABLE affiliate_withdrawal_requests
      ADD CONSTRAINT affiliate_withdrawal_requests_balance_source_check
      CHECK (balance_source IN ('affiliate', 'wallet'));
  END IF;
END $$;

-- =============================================================================
-- Fim. Opcional: revisar CHECK de status em affiliate_withdrawal_requests
-- (valores usados pelo app: pending, approved, paid, rejected)
-- =============================================================================
