-- Cotas extras grátis (promo Copa → Brasileirão): unit/total = 0, não entram na receita do PIX.
--
-- Pode rodar mais de uma vez. Avisos como
--   column "is_promo_bonus" already exists, skipping
--   relation "tickets_is_promo_bonus_idx" already exists, skipping
-- são normais: o banco já estava atualizado.
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS is_promo_bonus BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_unit_price_cents_check;
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_total_amount_cents_check;

ALTER TABLE tickets
  ADD CONSTRAINT tickets_unit_price_cents_check
  CHECK (
    (is_promo_bonus AND unit_price_cents = 0)
    OR (NOT is_promo_bonus AND unit_price_cents > 0)
  );

ALTER TABLE tickets
  ADD CONSTRAINT tickets_total_amount_cents_check
  CHECK (
    (is_promo_bonus AND total_amount_cents = 0)
    OR (NOT is_promo_bonus AND total_amount_cents > 0)
  );

CREATE INDEX IF NOT EXISTS tickets_is_promo_bonus_idx ON tickets (is_promo_bonus)
  WHERE is_promo_bonus = true;
