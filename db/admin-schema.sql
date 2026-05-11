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

ALTER TABLE affiliate_withdrawal_requests
  ADD COLUMN IF NOT EXISTS balance_source text NOT NULL DEFAULT 'affiliate';

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

-- Premiação oficial — fechamentos e prêmios creditados.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS prize_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_key text NOT NULL UNIQUE,
  competition_id integer NOT NULL,
  bolao_type text NOT NULL CHECK (bolao_type IN ('general', 'daily')),
  date_br text,
  status text NOT NULL DEFAULT 'processed',
  total_revenue_cents integer NOT NULL DEFAULT 0,
  pool_cents integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prize_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_id uuid NOT NULL REFERENCES prize_closures (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  ticket_id text NOT NULL,
  rank_position integer NOT NULL,
  amount_cents integer NOT NULL,
  total_points integer NOT NULL DEFAULT 0,
  exact_count integer NOT NULL DEFAULT 0,
  outcome_count integer NOT NULL DEFAULT 0,
  goals_count integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  transaction_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (closure_id, ticket_id)
);

CREATE INDEX IF NOT EXISTS prize_closures_competition_idx
  ON prize_closures (competition_id, bolao_type);

CREATE INDEX IF NOT EXISTS prize_awards_user_idx
  ON prize_awards (user_id);
