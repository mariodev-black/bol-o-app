import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";

let ensured = false;

/**
 * Cria (idempotente) APENAS as tabelas NOVAS de conteúdo editável da home:
 * - `home_banners`     → slides do HomeBannerCarousel
 * - `home_bolao_cards` → cards do ProximosBolaoCarousel
 *
 * IMPORTANTE (produção com usuários ativos): este schema é totalmente isolado.
 * Não altera, não adiciona coluna e não cria FK em NENHUMA tabela existente
 * (users, tickets, predictions, matches_cache, prizes, …). Só `CREATE TABLE
 * IF NOT EXISTS`. A imagem fica em `image_data` (bytea) no próprio Postgres,
 * mesmo padrão já usado para avatares de usuário.
 */
export async function ensureHomeContentSchema(client?: PoolClient): Promise<void> {
  if (ensured && !client) return;
  const pool = getPool();
  const c = client ?? (await pool.connect());
  const release = !client;
  try {
    await c.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await c.query(`
      CREATE TABLE IF NOT EXISTS home_banners (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        alt text NOT NULL DEFAULT '',
        href text NOT NULL DEFAULT '',
        action_key text,
        image_data bytea,
        image_mime text,
        sort_order integer NOT NULL DEFAULT 0,
        enabled boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await c.query(`
      CREATE INDEX IF NOT EXISTS home_banners_order_idx
        ON home_banners (enabled, sort_order)
    `);

    await c.query(`
      CREATE TABLE IF NOT EXISTS home_bolao_cards (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL DEFAULT '',
        badge text,
        badge_variant text,
        date_text text,
        time_text text,
        prize_label text,
        prize_unit text,
        href text NOT NULL DEFAULT '',
        is_primary boolean NOT NULL DEFAULT false,
        image_data bytea,
        image_mime text,
        sort_order integer NOT NULL DEFAULT 0,
        enabled boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await c.query(`
      CREATE INDEX IF NOT EXISTS home_bolao_cards_order_idx
        ON home_bolao_cards (enabled, sort_order)
    `);

    ensured = true;
  } finally {
    if (release) c.release();
  }
}
