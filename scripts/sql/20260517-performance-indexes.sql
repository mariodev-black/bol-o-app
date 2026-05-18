-- Índices de performance (PostgreSQL). Rode uma vez em produção:
--   psql "$DATABASE_URL" -f scripts/sql/20260517-performance-indexes.sql
-- Idempotente: CREATE INDEX IF NOT EXISTS

-- predictions (ranking, bolões, cron, admin)
CREATE INDEX IF NOT EXISTS predictions_bolao_type_idx ON predictions (bolao_type);
CREATE INDEX IF NOT EXISTS predictions_user_id_idx ON predictions (user_id);
CREATE INDEX IF NOT EXISTS predictions_ticket_id_idx ON predictions (ticket_id);
CREATE INDEX IF NOT EXISTS predictions_match_id_idx ON predictions (match_id);
CREATE INDEX IF NOT EXISTS predictions_submitted_at_desc_idx ON predictions (submitted_at DESC);
CREATE INDEX IF NOT EXISTS predictions_bolao_extra_ticket_idx ON predictions (ticket_id) WHERE bolao_type = 'extra';

-- tickets (checkout, ranking, listagens)
CREATE INDEX IF NOT EXISTS tickets_user_paid_idx ON tickets (user_id) WHERE status = 'paid';
CREATE INDEX IF NOT EXISTS tickets_status_type_idx ON tickets (status, ticket_type);
CREATE INDEX IF NOT EXISTS tickets_status_type_extra_idx
  ON tickets (status, ticket_type, extra_championship_id)
  WHERE status = 'paid';
CREATE INDEX IF NOT EXISTS tickets_transaction_id_idx ON tickets (transaction_id);

-- matches_cache (partidas, cron, joins com predictions)
CREATE INDEX IF NOT EXISTS matches_cache_comp_synced_idx ON matches_cache (competition_id, synced_at DESC);
CREATE INDEX IF NOT EXISTS matches_cache_comp_date_idx ON matches_cache (competition_id, date_br);
CREATE INDEX IF NOT EXISTS matches_cache_comp_kickoff_idx ON matches_cache (competition_id, kickoff_at)
  WHERE kickoff_at IS NOT NULL;

-- users (login, afiliados)
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_uq_idx ON users (referral_code)
  WHERE referral_code IS NOT NULL AND referral_code <> '';
CREATE INDEX IF NOT EXISTS users_referred_by_idx ON users (referred_by_user_id)
  WHERE referred_by_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_cpf_uq_idx ON users (cpf) WHERE cpf IS NOT NULL AND cpf <> '';
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_uq_idx ON users (google_sub) WHERE google_sub IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uq_idx ON users (lower(trim(email)));

-- transactions
CREATE INDEX IF NOT EXISTS transactions_user_created_idx ON transactions (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS transactions_provider_tx_uq_idx ON transactions (provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

-- referral_commissions
CREATE INDEX IF NOT EXISTS referral_commissions_referrer_created_idx
  ON referral_commissions (referrer_user_id, created_at DESC);

-- affiliate withdrawals
CREATE INDEX IF NOT EXISTS affiliate_withdrawals_user_status_src_idx
  ON affiliate_withdrawal_requests (user_id, status, balance_source);
