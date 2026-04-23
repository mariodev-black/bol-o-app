-- Afiliados: código próprio + opcionalmente quem indicou.
-- Rode UMA vez em bancos que já tinham `users` sem estas colunas.
--
-- psql "$DATABASE_URL" -f scripts/migrate-users-affiliates.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL;

UPDATE users
SET referral_code = upper(left(replace(gen_random_uuid()::text, '-', ''), 10))
WHERE referral_code IS NULL;

-- Se ainda houver colisão rara, rode de novo só o UPDATE acima ou ajuste manualmente.

CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_key ON users (referral_code);

ALTER TABLE users ALTER COLUMN referral_code SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users (referred_by_user_id) WHERE referred_by_user_id IS NOT NULL;
