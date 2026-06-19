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
        ticket_type text NOT NULL CHECK (ticket_type IN ('general', 'daily', 'extra')),
        competition_id integer NOT NULL,
        scope_mode text NOT NULL CHECK (
          scope_mode IN ('full_competition', 'daily_dates', 'round', 'weekend')
        ),
        scope_dates text[] NOT NULL DEFAULT '{}',
        round_number integer,
        edition_number integer,
        unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
        sale_enabled boolean NOT NULL DEFAULT false,
        shop_visible boolean NOT NULL DEFAULT true,
        sort_order integer NOT NULL DEFAULT 0,
        logo_url text,
        logo_variant text,
        use_competition_logo boolean NOT NULL DEFAULT true,
        prize_pool_bps integer NOT NULL DEFAULT 6000 CHECK (prize_pool_bps >= 0 AND prize_pool_bps <= 10000),
        prize_tiers jsonb NOT NULL DEFAULT '[{"rank":1,"poolBps":5000},{"rank":2,"poolBps":3000},{"rank":3,"poolBps":2000}]'::jsonb,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        enabled boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
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
