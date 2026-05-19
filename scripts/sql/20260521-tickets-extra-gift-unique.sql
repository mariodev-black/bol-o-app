-- =============================================================================
-- 20260521-tickets-extra-gift-unique.sql
--
-- Idempotência do brinde "Bolão extra grátis por rodada".
--
-- Garante no nível do banco que NÃO pode existir mais de uma cota grátis ativa
-- (status paid/approved) por:
--    (user_id, extra_championship_id, round_number)
-- quando essa cota foi gerada pelo brinde (`is_promo_bonus = true`).
--
-- Por que partial unique:
--   - Tickets pagos normais (is_promo_bonus = false) NÃO são afetados.
--   - Cotas grátis com status 'cancelled' (operação admin) também não bloqueiam
--     um novo brinde — o usuário pode receber outro se o anterior foi anulado.
--
-- Por que isso é necessário:
--   Em ambientes multi-instância (PM2 cluster, multi-region), duas requisições
--   POST /api/promotions/extra-gift simultâneas passariam pelo SELECT pré-check
--   sem encontrar nada e cada uma criaria um ticket grátis. Este índice
--   transforma o cenário em ERRO de constraint, capturado pelo `ON CONFLICT
--   DO NOTHING` do INSERT em `lib/promotions/extra-gift.ts`.
--
-- Idempotente: re-execução é segura (IF NOT EXISTS).
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS tickets_extra_gift_unique
  ON tickets (user_id, extra_championship_id, round_number)
  WHERE ticket_type = 'extra'
    AND is_promo_bonus = true
    AND status IN ('paid', 'approved');

-- (opcional, leitura) índice de apoio caso a query passe a fazer ORDER BY user.
-- Já existe `tickets_is_promo_bonus_idx` (20260516) que cobre buscas por flag.
