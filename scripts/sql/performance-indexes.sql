-- Índices para caminhos quentes: ranking, bootstrap, palpites, listagem de cotas.
-- PostgreSQL. Rode fora de transação. CONCURRENTLY não bloqueia leituras longas.
--
-- Aplicação:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/performance-indexes.sql
--
-- (Se CONCURRENTLY falhar em transação implícita, use -1 ou rode cada CREATE numa sessão.)

-- === predictions ===
-- Ranking: filtro por bolão + colunas de agregação (INCLUDE reduz idas ao heap).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_predictions_bolao_cover
  ON predictions (bolao_type)
  INCLUDE (ticket_id, match_id, score_casa, score_visitante, submitted_at);

-- Palpites por usuário (listPredictions / resumo / user-tickets).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_predictions_user_submitted
  ON predictions (user_id, submitted_at ASC);

-- Filtro comum: usuário + bolão (+ ticket opcional — prefixo do índice ajuda).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_predictions_user_bolao_ticket_sub
  ON predictions (user_id, bolao_type, ticket_id, submitted_at ASC);

-- Ticket (palpites de uma cota, match ids distintos).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_predictions_ticket_id
  ON predictions (ticket_id);

-- === tickets ===
-- listPaidTicketsForUser: WHERE user_id AND status = 'paid' ORDER BY paid_at/created_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_user_paid_sort
  ON tickets (user_id, paid_at DESC NULLS LAST, created_at DESC)
  WHERE status = 'paid';

-- loadPaidTickets ranking: status + tipo
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_paid_type
  ON tickets (status, ticket_type)
  WHERE status = 'paid';

-- Consultas com id::text = $1 — alinha com inferBolaoType / rotas legadas.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_id_text
  ON tickets ((id::text));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_user_id_text
  ON tickets ((user_id::text));

-- === manutenção de estatísticas (planejador) ===
ANALYZE predictions;
ANALYZE tickets;
