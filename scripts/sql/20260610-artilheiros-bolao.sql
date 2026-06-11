-- Bolão dos Artilheiros — schema + catálogo (elencos-copa-2026.json)
-- Run (servidor): sudo bash scripts/setup-artilheiros-bolao.sh
-- Run (local):     npm run db:artilheiros

-- ─── Tipo de ticket ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ticket_type_enum' AND e.enumlabel = 'artilheiros'
  ) THEN
    ALTER TYPE ticket_type_enum ADD VALUE 'artilheiros';
  END IF;
END $$;

-- CHECK legado em tickets (alguns bancos têm lista fixa sem artilheiros)
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_ticket_type_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_ticket_type_check
  CHECK (ticket_type::text IN ('general', 'daily', 'extra', 'artilheiros'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transactions_ticket_type_check'
  ) THEN
    ALTER TABLE transactions DROP CONSTRAINT transactions_ticket_type_check;
    ALTER TABLE transactions ADD CONSTRAINT transactions_ticket_type_check
      CHECK (ticket_type::text IN ('general', 'daily', 'extra', 'artilheiros'));
  END IF;
END $$;

-- ─── Catálogo de seleções (fonte: app/shared/elencos-copa-2026.json) ─────────
CREATE TABLE IF NOT EXISTS artilheiro_catalog_teams (
  api_team_id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  display_nome TEXT NOT NULL,
  codigo TEXT NOT NULL,
  pais TEXT NOT NULL,
  logo TEXT,
  grupo TEXT,
  grupo_label TEXT,
  rank INTEGER,
  descricao TEXT,
  total_jogadores INTEGER NOT NULL DEFAULT 0,
  catalog_version TEXT NOT NULL DEFAULT '',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS artilheiro_catalog_teams_codigo_idx
  ON artilheiro_catalog_teams(codigo);

CREATE TABLE IF NOT EXISTS artilheiro_catalog_players (
  api_player_id INTEGER PRIMARY KEY,
  api_team_id INTEGER NOT NULL REFERENCES artilheiro_catalog_teams(api_team_id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  idade INTEGER,
  numero INTEGER,
  posicao TEXT NOT NULL,
  posicao_label TEXT NOT NULL,
  foto TEXT,
  catalog_version TEXT NOT NULL DEFAULT '',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS artilheiro_catalog_players_team_idx
  ON artilheiro_catalog_players(api_team_id);

CREATE INDEX IF NOT EXISTS artilheiro_catalog_players_posicao_idx
  ON artilheiro_catalog_players(posicao);

-- ─── Palpites dos usuários ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artilheiro_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  slot SMALLINT NOT NULL CHECK (slot IN (1, 2, 3)),
  api_player_id INTEGER NOT NULL,
  api_team_id INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  team_name TEXT NOT NULL,
  team_logo TEXT,
  player_photo TEXT,
  player_position TEXT,
  player_number INTEGER,
  player_age INTEGER,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, slot),
  UNIQUE (ticket_id, api_player_id)
);

CREATE INDEX IF NOT EXISTS artilheiro_picks_user_id_idx ON artilheiro_picks(user_id);
CREATE INDEX IF NOT EXISTS artilheiro_picks_ticket_id_idx ON artilheiro_picks(ticket_id);
CREATE INDEX IF NOT EXISTS artilheiro_picks_player_id_idx ON artilheiro_picks(api_player_id);

-- ─── Resultado oficial (admin) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artilheiro_official_results (
  slot SMALLINT PRIMARY KEY CHECK (slot IN (1, 2, 3)),
  api_player_id INTEGER NOT NULL,
  api_team_id INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  team_name TEXT NOT NULL,
  team_logo TEXT,
  player_photo TEXT,
  goals INTEGER NOT NULL DEFAULT 0 CHECK (goals >= 0),
  applied_at TIMESTAMPTZ,
  applied_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Pontuação por cota ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artilheiro_ticket_scores (
  ticket_id UUID PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position_points INTEGER NOT NULL DEFAULT 0,
  bonus_points INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS artilheiro_ticket_scores_user_id_idx ON artilheiro_ticket_scores(user_id);
CREATE INDEX IF NOT EXISTS artilheiro_ticket_scores_total_idx ON artilheiro_ticket_scores(total_points DESC);
