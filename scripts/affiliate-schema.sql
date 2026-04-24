-- Comissões de indicação (um registro por transação PIX paga do indicado).
-- Rode: psql "$DATABASE_URL" -f scripts/affiliate-schema.sql

CREATE TABLE IF NOT EXISTS referral_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  tier text NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold', 'diamond')),
  commission_index integer NOT NULL CHECK (commission_index >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_commissions_transaction_unique UNIQUE (transaction_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_commissions_referrer_referred_unique
  ON referral_commissions (referrer_user_id, referred_user_id);

CREATE INDEX IF NOT EXISTS idx_referral_commissions_referrer ON referral_commissions (referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referred ON referral_commissions (referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_created ON referral_commissions (created_at DESC);

-- Solicitação de saque (aprovação admin em etapa futura).
CREATE TABLE IF NOT EXISTS affiliate_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  pix_key_type text NOT NULL CHECK (pix_key_type IN ('cpf', 'email', 'phone', 'random')),
  pix_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_withdrawals_user ON affiliate_withdrawal_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_withdrawals_status ON affiliate_withdrawal_requests (status);
