-- Promo "Placar exato — Amistoso Brasil x Panamá" (estrutura separada da Champions).
CREATE TABLE IF NOT EXISTS brasil_panama_placar_promo_submissions (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  pred_casa SMALLINT NOT NULL CHECK (pred_casa >= 0 AND pred_casa <= 99),
  pred_visitante SMALLINT NOT NULL CHECK (pred_visitante >= 0 AND pred_visitante <= 99),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS brasil_panama_placar_promo_submissions_created_at_idx
  ON brasil_panama_placar_promo_submissions (created_at DESC);

-- App roda como bolao_user; tabela criada via psql como postgres precisa de owner/grant.
ALTER TABLE brasil_panama_placar_promo_submissions OWNER TO bolao_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE brasil_panama_placar_promo_submissions TO bolao_user;
