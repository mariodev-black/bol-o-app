-- Índice único para notificação promocional do bolão (uma por usuário).
-- Rodar: psql "$DATABASE_URL" -f scripts/sql/20260524-user-notifications-bolao-promo.sql

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS user_notifications_bolao_promo_uq
  ON user_notifications (user_id, kind)
  WHERE kind = 'bolao_promo';

COMMIT;
