import { getPool } from "@/lib/db";
import { ensureBolaoDefinitionsSchema } from "@/lib/boloes/definitions/schema";
import {
  mapBolaoDefinitionRow,
  normalizeBolaoDefinitionInput,
  slugifyBolaoName,
} from "@/lib/boloes/definitions/mapper";
import type {
  BolaoDefinition,
  BolaoDefinitionInput,
} from "@/lib/boloes/definitions/types";

export async function listBolaoDefinitions(opts?: {
  includeDisabled?: boolean;
}): Promise<BolaoDefinition[]> {
  await ensureBolaoDefinitionsSchema();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT *
       FROM bolao_definitions
      ${opts?.includeDisabled ? "" : "WHERE enabled = true"}
      ORDER BY sort_order ASC, display_name ASC`,
  );
  return rows.map(mapBolaoDefinitionRow);
}

export async function listBolaoDefinitionsForSale(): Promise<BolaoDefinition[]> {
  await ensureBolaoDefinitionsSchema();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT *
       FROM bolao_definitions
      WHERE enabled = true
        AND sale_enabled = true
        AND shop_visible = true
      ORDER BY sort_order ASC, display_name ASC`,
  );
  return rows.map(mapBolaoDefinitionRow);
}

export async function getBolaoDefinitionById(id: string): Promise<BolaoDefinition | null> {
  await ensureBolaoDefinitionsSchema();
  const pool = getPool();
  const { rows } = await pool.query(`SELECT * FROM bolao_definitions WHERE id = $1 LIMIT 1`, [
    id,
  ]);
  const row = rows[0];
  return row ? mapBolaoDefinitionRow(row) : null;
}

export async function getBolaoDefinitionsByIds(ids: string[]): Promise<BolaoDefinition[]> {
  if (ids.length === 0) return [];
  await ensureBolaoDefinitionsSchema();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM bolao_definitions WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  return rows.map(mapBolaoDefinitionRow);
}

export async function duplicateBolaoDefinition(id: string): Promise<BolaoDefinition | null> {
  const source = await getBolaoDefinitionById(id);
  if (!source) return null;
  return createBolaoDefinition({
    displayName: `${source.displayName} (cópia)`,
    subtitle: source.subtitle,
    ticketType: source.ticketType,
    competitionId: source.competitionId,
    scopeMode: source.scopeMode,
    scopeDates: [...source.scopeDates],
    roundNumber: source.roundNumber,
    editionNumber: source.editionNumber,
    unitPriceCents: source.unitPriceCents,
    saleEnabled: false,
    shopVisible: source.shopVisible,
    sortOrder: source.sortOrder + 1,
    logoUrl: source.logoUrl,
    logoVariant: source.logoVariant,
    useCompetitionLogo: source.useCompetitionLogo,
    prizePoolBps: source.prizePoolBps,
    prizeTiers: source.prizeTiers,
    metadata: { ...source.metadata, duplicatedFrom: id },
    enabled: true,
  });
}

export async function createBolaoDefinition(
  input: BolaoDefinitionInput,
): Promise<BolaoDefinition> {
  await ensureBolaoDefinitionsSchema();
  const data = normalizeBolaoDefinitionInput(input);
  const pool = getPool();

  let slug = data.slug;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO bolao_definitions (
           slug, display_name, subtitle, ticket_type, competition_id,
           scope_mode, scope_dates, round_number, edition_number,
           unit_price_cents, sale_enabled, shop_visible, sort_order,
           logo_url, logo_variant, use_competition_logo,
           prize_pool_bps, prize_tiers, metadata, enabled
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9,
           $10, $11, $12, $13,
           $14, $15, $16,
           $17, $18::jsonb, $19::jsonb, $20
         )
         RETURNING *`,
        [
          slug,
          data.displayName,
          data.subtitle,
          data.ticketType,
          data.competitionId,
          data.scopeMode,
          data.scopeDates,
          data.roundNumber,
          data.editionNumber,
          data.unitPriceCents,
          data.saleEnabled,
          data.shopVisible,
          data.sortOrder,
          data.logoUrl,
          data.logoVariant,
          data.useCompetitionLogo,
          data.prizePoolBps,
          JSON.stringify(data.prizeTiers),
          JSON.stringify(data.metadata),
          data.enabled,
        ],
      );
      return mapBolaoDefinitionRow(rows[0]!);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== "23505" || attempt >= 4) throw error;
      slug = `${data.slug}-${attempt + 2}`;
    }
  }
  throw new Error("Não foi possível gerar slug único");
}

export async function updateBolaoDefinition(
  id: string,
  input: BolaoDefinitionInput,
): Promise<BolaoDefinition | null> {
  await ensureBolaoDefinitionsSchema();
  const data = normalizeBolaoDefinitionInput(input);
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE bolao_definitions SET
       slug = $2,
       display_name = $3,
       subtitle = $4,
       ticket_type = $5,
       competition_id = $6,
       scope_mode = $7,
       scope_dates = $8,
       round_number = $9,
       edition_number = $10,
       unit_price_cents = $11,
       sale_enabled = $12,
       shop_visible = $13,
       sort_order = $14,
       logo_url = $15,
       logo_variant = $16,
       use_competition_logo = $17,
       prize_pool_bps = $18,
       prize_tiers = $19::jsonb,
       metadata = $20::jsonb,
       enabled = $21,
       updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      data.slug || slugifyBolaoName(data.displayName),
      data.displayName,
      data.subtitle,
      data.ticketType,
      data.competitionId,
      data.scopeMode,
      data.scopeDates,
      data.roundNumber,
      data.editionNumber,
      data.unitPriceCents,
      data.saleEnabled,
      data.shopVisible,
      data.sortOrder,
      data.logoUrl,
      data.logoVariant,
      data.useCompetitionLogo,
      data.prizePoolBps,
      JSON.stringify(data.prizeTiers),
      JSON.stringify(data.metadata),
      data.enabled,
    ],
  );
  const row = rows[0];
  return row ? mapBolaoDefinitionRow(row) : null;
}

export async function deleteBolaoDefinition(id: string): Promise<boolean> {
  await ensureBolaoDefinitionsSchema();
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE bolao_definitions SET enabled = false, sale_enabled = false, updated_at = now() WHERE id = $1`,
    [id],
  );
  return (rowCount ?? 0) > 0;
}

export async function listMatchDatesForCompetition(
  competitionId: number,
): Promise<string[]> {
  const pool = getPool();
  const { rows } = await pool.query<{ date_br: string }>(
    `SELECT DISTINCT date_br
       FROM matches_cache
      WHERE competition_id = $1
        AND date_br IS NOT NULL
        AND date_br <> ''
      ORDER BY date_br ASC`,
    [competitionId],
  );
  return rows.map((r) => r.date_br).filter(Boolean);
}

export async function listMatchRoundsForCompetition(
  competitionId: number,
): Promise<Array<{ round: number; label: string; matchCount: number }>> {
  const pool = getPool();
  const { rows } = await pool.query<{
    rodada: number;
    match_count: string;
  }>(
    `SELECT rodada, COUNT(*)::int AS match_count
       FROM matches_cache
      WHERE competition_id = $1
        AND rodada IS NOT NULL
        AND rodada > 0
      GROUP BY rodada
      ORDER BY rodada ASC`,
    [competitionId],
  );
  return rows.map((r) => ({
    round: Number(r.rodada),
    label: `${r.rodada}ª rodada`,
    matchCount: Number(r.match_count) || 0,
  }));
}
