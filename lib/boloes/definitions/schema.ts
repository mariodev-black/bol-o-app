import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";

let ensured = false;

export async function ensureBolaoDefinitionsSchema(client?: PoolClient): Promise<void> {
  if (ensured && !client) return;
  const pool = getPool();
  const c = client ?? (await pool.connect());
  const release = !client;
  try {
    await c.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await c.query(`
      CREATE TABLE IF NOT EXISTS bolao_definitions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug text NOT NULL UNIQUE,
        display_name text NOT NULL,
        subtitle text,
        description text,
        ticket_type text NOT NULL CHECK (ticket_type IN ('general', 'daily', 'extra')),
        competition_id integer NOT NULL,
        competition_ids integer[] NOT NULL DEFAULT '{}',
        scope_mode text NOT NULL CHECK (
          scope_mode IN (
            'full_competition', 'daily_dates', 'round', 'weekend',
            'custom_matches', 'multi_competition'
          )
        ),
        scope_dates text[] NOT NULL DEFAULT '{}',
        scope_match_ids bigint[] NOT NULL DEFAULT '{}',
        scope_config jsonb NOT NULL DEFAULT '{}'::jsonb,
        round_number integer,
        edition_number integer,
        unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
        sale_enabled boolean NOT NULL DEFAULT false,
        shop_visible boolean NOT NULL DEFAULT true,
        sort_order integer NOT NULL DEFAULT 0,
        logo_url text,
        banner_url text,
        logo_variant text,
        use_competition_logo boolean NOT NULL DEFAULT true,
        prize_pool_bps integer NOT NULL DEFAULT 6000 CHECK (prize_pool_bps >= 0 AND prize_pool_bps <= 10000),
        prize_tiers jsonb NOT NULL DEFAULT '[{"rank":1,"poolBps":5000},{"rank":2,"poolBps":3000},{"rank":3,"poolBps":2000}]'::jsonb,
        scoring_config jsonb NOT NULL DEFAULT '{}'::jsonb,
        starts_at timestamptz,
        ends_at timestamptz,
        settlement_at timestamptz,
        prize_release_at timestamptz,
        max_tickets_per_user integer,
        lifecycle_status text NOT NULL DEFAULT 'programado',
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        enabled boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await c.query(`
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
        ADD COLUMN IF NOT EXISTS scoring_config jsonb NOT NULL DEFAULT '{}'::jsonb
    `);

    await c.query(`
      UPDATE bolao_definitions
         SET competition_ids = ARRAY[competition_id]
       WHERE competition_ids IS NULL OR cardinality(competition_ids) = 0
    `);

    await c.query(`
      ALTER TABLE bolao_definitions DROP CONSTRAINT IF EXISTS bolao_definitions_scope_mode_check
    `);
    await c.query(`
      ALTER TABLE bolao_definitions ADD CONSTRAINT bolao_definitions_scope_mode_check
        CHECK (scope_mode IN (
          'full_competition', 'daily_dates', 'round', 'weekend',
          'custom_matches', 'multi_competition'
        ))
    `);

    await c.query(`
      ALTER TABLE bolao_definitions DROP CONSTRAINT IF EXISTS bolao_definitions_lifecycle_status_check
    `);
    await c.query(`
      ALTER TABLE bolao_definitions ADD CONSTRAINT bolao_definitions_lifecycle_status_check
        CHECK (lifecycle_status IN (
          'programado', 'aberto', 'ao_vivo', 'encerrado', 'finalizado', 'premiacao_liberada'
        ))
    `);

    await c.query(`
      CREATE INDEX IF NOT EXISTS bolao_definitions_sale_idx
        ON bolao_definitions (sale_enabled, shop_visible, enabled, sort_order)
    `);
    await c.query(`
      CREATE INDEX IF NOT EXISTS bolao_definitions_competition_idx
        ON bolao_definitions (competition_id)
    `);
    await c.query(`
      CREATE INDEX IF NOT EXISTS bolao_definitions_lifecycle_idx
        ON bolao_definitions (lifecycle_status, shop_visible, enabled)
    `);

    await c.query(`
      CREATE TABLE IF NOT EXISTS bolao_definition_audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        bolao_definition_id uuid NOT NULL REFERENCES bolao_definitions(id) ON DELETE CASCADE,
        action text NOT NULL,
        actor_user_id uuid,
        actor_email text,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await c.query(`
      CREATE INDEX IF NOT EXISTS bolao_definition_audit_logs_bolao_idx
        ON bolao_definition_audit_logs (bolao_definition_id, created_at DESC)
    `);

    await c.query(`
      ALTER TABLE tickets
        ADD COLUMN IF NOT EXISTS bolao_definition_id uuid
        REFERENCES bolao_definitions(id) ON DELETE SET NULL
    `);
    await c.query(`
      CREATE INDEX IF NOT EXISTS tickets_bolao_definition_id_idx
        ON tickets (bolao_definition_id)
        WHERE bolao_definition_id IS NOT NULL
    `);
    ensured = true;
  } finally {
    if (release) c.release();
  }
}
