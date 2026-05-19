-- =======================================================================
-- v2.2 — Encerramento idempotente do ticket
--
-- Adiciona `tickets.settled_at` (timestamptz NULL). Quando todos os jogos do
-- bolão correspondente terminam e o `processPrizeClosuresAfterMatchSync` é
-- executado com sucesso (criando `prize_closures` + `prize_awards`), os
-- tickets daquele closure recebem `settled_at = now()`.
--
-- IMPORTANTE:
--   * `tickets.status` continua `'paid'` — não quebra ranking / queries antigas.
--   * `settled_at` é a fonte de verdade para UX (label "Encerrado") e para
--     proteção idempotente: tickets já settled NÃO disparam novo crédito/prêmio.
--   * A coluna é `NULL`-default; o backfill marca tickets com placares todos
--     completos para evitar reprocesso de bolões antigos.
--
-- Rodar:  psql "$DATABASE_URL" -f scripts/sql/20260521-tickets-settled-at.sql
-- =======================================================================

BEGIN;

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS settled_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS settled_closure_id uuid NULL;

-- Indice para listagens "ativos vs encerrados" no perfil do usuario.
CREATE INDEX IF NOT EXISTS idx_tickets_user_settled
  ON tickets (user_id, settled_at DESC NULLS FIRST);

-- Indice para "ainda não fechados" (usado por jobs administrativos).
CREATE INDEX IF NOT EXISTS idx_tickets_open
  ON tickets (ticket_type, status)
  WHERE settled_at IS NULL;

COMMIT;
