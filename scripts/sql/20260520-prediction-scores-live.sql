-- =======================================================================
-- Pontuação ao vivo (v2.1): tabela `prediction_scores` derivada por palpite.
--
-- Conceito:
--   - Cada linha em `predictions` ganha 0..1 linha em `prediction_scores` com
--     os pontos calculados pelo `calcPredictionPoints` no momento do último
--     placar conhecido daquela partida.
--   - O worker realtime (lib/football/persistence.ts → runCascadeAfterMatchUpdate)
--     recomputa as linhas afetadas em batch sempre que `scoredChanged=true`.
--   - Pontos PODEM DIMINUIR — se o placar muda (1x1 com palpite 1x1 = 6 pts,
--     depois 2x1 = 0..3 pts dependendo do palpite). A coluna é sobrescrita.
--
-- Esta migration é IDEMPOTENTE.
-- Rodar:  psql "$DATABASE_URL" -f scripts/sql/20260520-prediction-scores-live.sql
-- =======================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- prediction_scores: cache derivado por palpite
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prediction_scores (
  prediction_id     uuid        PRIMARY KEY REFERENCES predictions(id) ON DELETE CASCADE,
  ticket_id         text        NOT NULL,
  user_id           uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id          bigint      NOT NULL,
  bolao_type        text        NOT NULL,

  -- Pontuação calculada por `calcPredictionPoints(palpite, real)`.
  points            integer     NOT NULL DEFAULT 0,
  exact             boolean     NOT NULL DEFAULT false,
  outcome_hit       boolean     NOT NULL DEFAULT false,
  goals_hit_count   integer     NOT NULL DEFAULT 0,

  -- Snapshot da partida no momento da última recompute (auditoria).
  last_match_status        text,
  last_result_casa         integer,
  last_result_visitante    integer,
  computed_at              timestamptz NOT NULL DEFAULT now()
);

-- Agregados rápidos por ticket (tela "meus tickets", ranking ao vivo).
CREATE INDEX IF NOT EXISTS idx_prediction_scores_ticket
  ON prediction_scores (ticket_id);

-- Top scorers globais por bolão.
CREATE INDEX IF NOT EXISTS idx_prediction_scores_bolao_points
  ON prediction_scores (bolao_type, points DESC);

-- Recompute por jogo (worker realtime → quem precisa atualizar?).
CREATE INDEX IF NOT EXISTS idx_prediction_scores_match
  ON prediction_scores (match_id);

-- "Meus tickets" / perfil do usuário.
CREATE INDEX IF NOT EXISTS idx_prediction_scores_user
  ON prediction_scores (user_id);

COMMIT;
