-- Admin security schema.
-- Execute once in production before enabling /admin.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS admin_2fa_secret text,
  ADD COLUMN IF NOT EXISTS admin_2fa_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_2fa_enabled_at timestamptz;

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

CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);

-- Promote the first admin manually, then configure 2FA at /admin/2fa:
-- UPDATE users SET role = 'super_admin' WHERE lower(email) = lower('seu-email@dominio.com');
