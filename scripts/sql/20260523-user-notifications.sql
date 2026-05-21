-- Notificações in-app por usuário (sininho no header).
-- Rodar: psql "$DATABASE_URL" -f scripts/sql/20260523-user-notifications.sql

BEGIN;

CREATE TABLE IF NOT EXISTS user_notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind       text NOT NULL DEFAULT 'system',
  title      text NOT NULL,
  preview    text NOT NULL,
  body       text NOT NULL,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_notifications_welcome_uq
  ON user_notifications (user_id, kind)
  WHERE kind = 'welcome';

CREATE INDEX IF NOT EXISTS user_notifications_user_created_idx
  ON user_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_notifications_unread_idx
  ON user_notifications (user_id)
  WHERE read_at IS NULL;

COMMIT;
