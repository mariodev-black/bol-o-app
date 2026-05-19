-- =======================================================================
-- Nova arquitetura de bolões (v2):
--   - matches_cache passa a guardar TODOS os campos canônicos da partida
--     (slug, IDs/escudos/siglas dos times, estádio, disputa_penalti, dados
--     do campeonato/temporada/rodada).
--   - championships_cache: snapshot por competição (nome, slug, temporada,
--     rodada_atual, status).
--   - tickets.round_number: bolão extra agora pode ser POR RODADA
--     (Ticket Extra — 17ª Rodada, 18ª Rodada, ...).
--   - índice de janela ativa (worker 1 min).
--
-- Esta migration é IDEMPOTENTE — pode ser rodada várias vezes.
-- Rodar contra o banco em ../db.ts; ex.:
--   psql "$DATABASE_URL" -f scripts/sql/20260519-arquitetura-bolao-v2.sql
-- =======================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) matches_cache — colunas novas
-- ---------------------------------------------------------------------
ALTER TABLE matches_cache
  ADD COLUMN IF NOT EXISTS slug                  text,
  ADD COLUMN IF NOT EXISTS disputa_penalti       boolean,
  ADD COLUMN IF NOT EXISTS penaltis_casa         integer,
  ADD COLUMN IF NOT EXISTS penaltis_visitante    integer,
  ADD COLUMN IF NOT EXISTS data_realizacao_iso   text,
  ADD COLUMN IF NOT EXISTS rodada                integer,
  ADD COLUMN IF NOT EXISTS rodada_slug           text,
  ADD COLUMN IF NOT EXISTS fase_nome             text,
  ADD COLUMN IF NOT EXISTS fase_slug             text,
  ADD COLUMN IF NOT EXISTS championship_name     text,
  ADD COLUMN IF NOT EXISTS championship_slug     text,
  ADD COLUMN IF NOT EXISTS championship_temporada text,
  ADD COLUMN IF NOT EXISTS home_team_id          integer,
  ADD COLUMN IF NOT EXISTS away_team_id          integer,
  ADD COLUMN IF NOT EXISTS estadio_id            integer,
  ADD COLUMN IF NOT EXISTS estadio_nome          text,
  ADD COLUMN IF NOT EXISTS provider_payload      jsonb;

-- Worker em tempo real filtra pelo apito recente (`kickoff_at`) e exclui finalizadas.
CREATE INDEX IF NOT EXISTS idx_matches_cache_active_window
  ON matches_cache (kickoff_at)
  WHERE lower(coalesce(status, '')) NOT LIKE '%finaliz%'
    AND lower(coalesce(status, '')) NOT LIKE '%encerr%'
    AND lower(coalesce(status, '')) NOT LIKE '%cancel%'
    AND lower(coalesce(status, '')) NOT LIKE '%adiad%'
    AND lower(coalesce(status, '')) NOT LIKE '%suspens%';

-- Lookup por competição + rodada (bolão extra POR RODADA).
CREATE INDEX IF NOT EXISTS idx_matches_cache_competition_round
  ON matches_cache (competition_id, rodada);

-- ---------------------------------------------------------------------
-- 2) championships_cache — snapshot do campeonato
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS championships_cache (
  competition_id        integer PRIMARY KEY,
  nome                  text        NOT NULL,
  slug                  text        NOT NULL,
  nome_popular          text,
  temporada             text,
  rodada_atual_numero   integer,
  rodada_atual_slug     text,
  rodada_atual_nome     text,
  rodada_atual_status   text,
  fase_atual_nome       text,
  fase_atual_slug       text,
  status                text,
  logo                  text,
  total_rodadas         integer,
  raw_payload           jsonb,
  fetched_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_championships_cache_slug
  ON championships_cache (slug);

-- ---------------------------------------------------------------------
-- 3) tickets.round_number — extra POR RODADA
-- ---------------------------------------------------------------------
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS round_number integer;

-- Cada cota extra pertence a UMA rodada do campeonato extra.
-- (Geral e diário ignoram esta coluna — fica NULL.)
CREATE INDEX IF NOT EXISTS idx_tickets_extra_round
  ON tickets (extra_championship_id, round_number)
  WHERE ticket_type = 'extra' AND round_number IS NOT NULL;

-- ---------------------------------------------------------------------
-- 4) Run log de syncs (auditoria do worker novo)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_run_log (
  id            bigserial PRIMARY KEY,
  kind          text        NOT NULL,
  status        text        NOT NULL,
  competition_id integer,
  match_id      integer,
  detail        jsonb,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sync_run_log_started_at
  ON sync_run_log (kind, started_at DESC);

COMMIT;
