-- Cache local para respostas da API Futebol (tabela, enriquecimento por fases).
-- GET /api/tabela le daqui; apos salvar palpite: 1x GET /tabela na API. Atualizacao em lote: janela noturna BRT ou GET /api/cron/football-snapshots.

CREATE TABLE IF NOT EXISTS football_api_cache (
  cache_key text PRIMARY KEY,
  competition_id integer NOT NULL,
  payload jsonb NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS football_api_cache_competition_idx ON football_api_cache (competition_id);
CREATE INDEX IF NOT EXISTS football_api_cache_synced_idx ON football_api_cache (synced_at DESC);
