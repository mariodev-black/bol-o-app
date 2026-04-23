-- Execute no PostgreSQL (uma vez) antes de usar login/registro.
-- Se a tabela já existia sem `name NOT NULL`, rode também:
--   scripts/migrate-users-name-not-null.sql
-- Afiliados / indicação:
--   scripts/migrate-users-affiliates.sql
--
-- Com URL no .env:
--   psql "$DATABASE_URL" -f scripts/auth-schema.sql
--
-- Com host/senha separados no .env (exporte e rode na pasta do projeto):
--   export PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE
--   psql -f scripts/auth-schema.sql

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  cpf TEXT UNIQUE,
  password_hash TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  google_sub TEXT UNIQUE,
  email_verified_at TIMESTAMPTZ,
  referral_code TEXT NOT NULL UNIQUE,
  referred_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_cpf ON users (cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users (referred_by_user_id) WHERE referred_by_user_id IS NOT NULL;
