-- Rode UMA vez se a tabela `users` já existia sem nome obrigatório.
-- Preenche nomes vazios e aplica NOT NULL em `name`.
--
-- psql "$DATABASE_URL" -f scripts/migrate-users-name-not-null.sql

UPDATE users
SET name = btrim(COALESCE(NULLIF(name, ''), split_part(email, '@', 1), 'Jogador'))
WHERE name IS NULL OR btrim(name) = '';

ALTER TABLE users ALTER COLUMN name SET NOT NULL;
