-- Motor modular de bolões v2: lifecycle, multi-campeonato, jogos customizados, auditoria.

ALTER TABLE bolao_definitions
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS competition_ids integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS scope_match_ids bigint[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS scope_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS settlement_at timestamptz,
  ADD COLUMN IF NOT EXISTS prize_release_at timestamptz,
  ADD COLUMN IF NOT EXISTS max_tickets_per_user integer,
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'programado',
  ADD COLUMN IF NOT EXISTS scoring_config jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE bolao_definitions
   SET competition_ids = ARRAY[competition_id]
 WHERE competition_ids IS NULL OR cardinality(competition_ids) = 0;

ALTER TABLE bolao_definitions DROP CONSTRAINT IF EXISTS bolao_definitions_scope_mode_check;
ALTER TABLE bolao_definitions ADD CONSTRAINT bolao_definitions_scope_mode_check
  CHECK (scope_mode IN (
    'full_competition', 'daily_dates', 'round', 'weekend',
    'custom_matches', 'multi_competition'
  ));

ALTER TABLE bolao_definitions DROP CONSTRAINT IF EXISTS bolao_definitions_lifecycle_status_check;
ALTER TABLE bolao_definitions ADD CONSTRAINT bolao_definitions_lifecycle_status_check
  CHECK (lifecycle_status IN (
    'programado', 'aberto', 'ao_vivo', 'encerrado', 'finalizado', 'premiacao_liberada'
  ));

CREATE INDEX IF NOT EXISTS bolao_definitions_lifecycle_idx
  ON bolao_definitions (lifecycle_status, shop_visible, enabled);

CREATE TABLE IF NOT EXISTS bolao_definition_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bolao_definition_id uuid NOT NULL REFERENCES bolao_definitions(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_user_id uuid,
  actor_email text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bolao_definition_audit_logs_bolao_idx
  ON bolao_definition_audit_logs (bolao_definition_id, created_at DESC);
