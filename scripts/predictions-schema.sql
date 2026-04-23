CREATE TABLE IF NOT EXISTS predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticket_id text NOT NULL,
  bolao_type text NOT NULL CHECK (bolao_type IN ('principal', 'diario')),
  match_id integer NOT NULL,
  score_casa integer NOT NULL CHECK (score_casa >= 0 AND score_casa <= 99),
  score_visitante integer NOT NULL CHECK (score_visitante >= 0 AND score_visitante <= 99),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ticket_id, match_id)
);

CREATE INDEX IF NOT EXISTS idx_predictions_user_ticket ON predictions (user_id, ticket_id);
CREATE INDEX IF NOT EXISTS idx_predictions_user_bolao ON predictions (user_id, bolao_type);
CREATE INDEX IF NOT EXISTS idx_predictions_user_match ON predictions (user_id, match_id);
CREATE INDEX IF NOT EXISTS idx_predictions_ticket ON predictions (ticket_id);
CREATE INDEX IF NOT EXISTS idx_predictions_bolao ON predictions (bolao_type);
CREATE INDEX IF NOT EXISTS idx_predictions_submitted_at ON predictions (submitted_at);
CREATE INDEX IF NOT EXISTS idx_predictions_updated_at ON predictions (updated_at);

