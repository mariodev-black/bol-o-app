-- Promo "Placar exato — Amistoso Brasil x Egito" (06/06/2026, fecha 18:55 BRT)
CREATE TABLE IF NOT EXISTS brasil_egito_placar_promo_submissions (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  pred_casa SMALLINT NOT NULL CHECK (pred_casa >= 0 AND pred_casa <= 99),
  pred_visitante SMALLINT NOT NULL CHECK (pred_visitante >= 0 AND pred_visitante <= 99),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS brasil_egito_placar_promo_submissions_created_at_idx
  ON brasil_egito_placar_promo_submissions (created_at DESC);
