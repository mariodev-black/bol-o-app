-- Códigos SMS do cadastro (tabela também criada automaticamente em runtime).
CREATE TABLE IF NOT EXISTS registration_sms_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 TEXT NOT NULL,
  cpf TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS registration_sms_codes_phone_created_idx
  ON registration_sms_codes (phone_e164, created_at DESC);
