-- Armazena bytes do avatar no banco (necessário em Vercel/serverless: public/avataruploads não persiste nem é servido após upload).
-- Rode uma vez em produção antes do deploy que usa /api/user/avatar-image.

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_upload_data BYTEA;

COMMENT ON COLUMN users.avatar_upload_data IS 'Imagem do avatar customizado (bytes). avatar_upload_filename continua sendo o identificador e sufixo MIME.';
