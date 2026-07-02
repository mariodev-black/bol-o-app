import { getPool } from "@/lib/db";
import { ensureBolaoDefinitionsSchema } from "@/lib/boloes/definitions/schema";
import {
  mapBolaoDefinitionRow,
  normalizeBolaoDefinitionInput,
  slugifyBolaoName,
} from "@/lib/boloes/definitions/mapper";
import type {
  AdminMatchPickerItem,
  BolaoDefinition,
  BolaoDefinitionInput,
  BolaoLifecycleStatus,
} from "@/lib/boloes/definitions/types";

function definitionInsertParams(data: ReturnType<typeof normalizeBolaoDefinitionInput>) {
  return [
    data.slug,
    data.displayName,
    data.subtitle,
    data.description,
    data.ticketType,
    data.competitionId,
    data.competitionIds,
    data.scopeMode,
    data.scopeDates,
    data.scopeMatchIds,
    JSON.stringify(data.scopeConfig),
    data.roundNumber,
    data.editionNumber,
    data.unitPriceCents,
    data.saleEnabled,
    data.shopVisible,
    data.sortOrder,
    data.logoUrl,
    data.bannerUrl,
    data.logoVariant,
    data.useCompetitionLogo,
    data.prizePoolBps,
    JSON.stringify(data.prizeTiers),
    JSON.stringify(data.scoringConfig),
    data.startsAt,
    data.endsAt,
    data.settlementAt,
    data.prizeReleaseAt,
    data.maxTicketsPerUser,
    data.lifecycleStatus,
    JSON.stringify(data.metadata),
    data.enabled,
  ];
}

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

export async function listBolaoDefinitionsForShop(): Promise<BolaoDefinition[]> {
  await ensureBolaoDefinitionsSchema();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT *
       FROM bolao_definitions
      WHERE enabled = true
        AND shop_visible = true
      ORDER BY sort_order ASC, display_name ASC`,
  );
  return rows.map(mapBolaoDefinitionRow);
}

/** @deprecated use listBolaoDefinitionsForShop */
export async function listBolaoDefinitionsForSale(): Promise<BolaoDefinition[]> {
  const items = await listBolaoDefinitionsForShop();
  return items.filter((d) => d.saleEnabled);
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

export async function updateBolaoLifecycleStatus(
  id: string,
  status: BolaoLifecycleStatus,
): Promise<void> {
  await ensureBolaoDefinitionsSchema();
  const pool = getPool();
  await pool.query(
    `UPDATE bolao_definitions SET lifecycle_status = $2, updated_at = now() WHERE id = $1`,
    [id, status],
  );
}

export async function duplicateBolaoDefinition(id: string): Promise<BolaoDefinition | null> {
  const source = await getBolaoDefinitionById(id);
  if (!source) return null;
  return createBolaoDefinition({
    displayName: `${source.displayName} (cópia)`,
    subtitle: source.subtitle,
    description: source.description,
    ticketType: source.ticketType,
    competitionId: source.competitionId,
    competitionIds: [...source.competitionIds],
    scopeMode: source.scopeMode,
    scopeDates: [...source.scopeDates],
    scopeMatchIds: [...source.scopeMatchIds],
    scopeConfig: JSON.parse(JSON.stringify(source.scopeConfig)),
    roundNumber: source.roundNumber,
    editionNumber: source.editionNumber,
    unitPriceCents: source.unitPriceCents,
    saleEnabled: false,
    shopVisible: source.shopVisible,
    sortOrder: source.sortOrder + 1,
    logoUrl: source.logoUrl,
    bannerUrl: source.bannerUrl,
    logoVariant: source.logoVariant,
    useCompetitionLogo: source.useCompetitionLogo,
    prizePoolBps: source.prizePoolBps,
    prizeTiers: source.prizeTiers,
    scoringConfig: source.scoringConfig,
    startsAt: source.startsAt,
    endsAt: source.endsAt,
    settlementAt: source.settlementAt,
    prizeReleaseAt: source.prizeReleaseAt,
    maxTicketsPerUser: source.maxTicketsPerUser,
    lifecycleStatus: "programado",
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
      const params = definitionInsertParams({ ...data, slug });
      const { rows } = await pool.query(
        `INSERT INTO bolao_definitions (
           slug, display_name, subtitle, description, ticket_type, competition_id,
           competition_ids, scope_mode, scope_dates, scope_match_ids, scope_config,
           round_number, edition_number, unit_price_cents, sale_enabled, shop_visible,
           sort_order, logo_url, banner_url, logo_variant, use_competition_logo,
           prize_pool_bps, prize_tiers, scoring_config,
           starts_at, ends_at, settlement_at, prize_release_at,
           max_tickets_per_user, lifecycle_status, metadata, enabled
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11::jsonb,
           $12, $13, $14, $15, $16,
           $17, $18, $19, $20, $21,
           $22, $23::jsonb, $24::jsonb,
           $25, $26, $27, $28,
           $29, $30, $31::jsonb, $32
         )
         RETURNING *`,
        params,
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
       description = $5,
       ticket_type = $6,
       competition_id = $7,
       competition_ids = $8,
       scope_mode = $9,
       scope_dates = $10,
       scope_match_ids = $11,
       scope_config = $12::jsonb,
       round_number = $13,
       edition_number = $14,
       unit_price_cents = $15,
       sale_enabled = $16,
       shop_visible = $17,
       sort_order = $18,
       logo_url = $19,
       banner_url = $20,
       logo_variant = $21,
       use_competition_logo = $22,
       prize_pool_bps = $23,
       prize_tiers = $24::jsonb,
       scoring_config = $25::jsonb,
       starts_at = $26,
       ends_at = $27,
       settlement_at = $28,
       prize_release_at = $29,
       max_tickets_per_user = $30,
       lifecycle_status = $31,
       metadata = $32::jsonb,
       enabled = $33,
       updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      data.slug || slugifyBolaoName(data.displayName),
      ...definitionInsertParams(data).slice(1),
    ],
  );
  const row = rows[0];
  return row ? mapBolaoDefinitionRow(row) : null;
}

export async function deleteBolaoDefinition(id: string): Promise<boolean> {
  await ensureBolaoDefinitionsSchema();
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE bolao_definitions
        SET enabled = false, sale_enabled = false, lifecycle_status = 'encerrado', updated_at = now()
      WHERE id = $1`,
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

export async function listMatchesForAdminPicker(opts: {
  competitionIds: number[];
  dateBR?: string | null;
  roundNumber?: number | null;
  limit?: number;
}): Promise<AdminMatchPickerItem[]> {
  if (opts.competitionIds.length === 0) return [];
  const pool = getPool();
  const params: unknown[] = [opts.competitionIds];
  let where = `m.competition_id = ANY($1::int[])`;
  if (opts.dateBR) {
    params.push(opts.dateBR);
    where += ` AND m.date_br = $${params.length}`;
  }
  if (opts.roundNumber != null && opts.roundNumber > 0) {
    params.push(opts.roundNumber);
    where += ` AND m.rodada = $${params.length}`;
  }
  const limit = Math.min(500, Math.max(1, opts.limit ?? 200));
  params.push(limit);
  const { rows } = await pool.query<{
    match_id: number;
    competition_id: number;
    date_br: string;
    hour_br: string | null;
    home_name: string;
    home_sigla: string;
    away_name: string;
    away_sigla: string;
    home_logo: string | null;
    away_logo: string | null;
    rodada: number | null;
    status: string;
    nome_popular: string | null;
  }>(
    `SELECT m.match_id, m.competition_id, m.date_br, m.hour_br,
            m.home_name, m.home_sigla, m.away_name, m.away_sigla,
            m.home_logo, m.away_logo,
            m.rodada, m.status, c.nome_popular
       FROM matches_cache m
       LEFT JOIN championships_cache c ON c.competition_id = m.competition_id
      WHERE ${where}
      ORDER BY m.date_br ASC, m.hour_br ASC NULLS LAST, m.match_id ASC
      LIMIT $${params.length}`,
    params,
  );
  return rows.map((r) => ({
    matchId: Number(r.match_id),
    competitionId: Number(r.competition_id),
    competitionName: r.nome_popular?.trim() || `Campeonato ${r.competition_id}`,
    dateBR: r.date_br,
    hour: r.hour_br?.slice(0, 5) ?? "--:--",
    homeName: r.home_name,
    homeSigla: r.home_sigla,
    homeLogo: r.home_logo?.trim() ? r.home_logo.trim() : null,
    awayName: r.away_name,
    awaySigla: r.away_sigla,
    awayLogo: r.away_logo?.trim() ? r.away_logo.trim() : null,
    rodada: r.rodada != null ? Number(r.rodada) : null,
    status: r.status,
  }));
}

export async function countPaidTicketsForDefinition(definitionId: string): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::int AS count
       FROM tickets
      WHERE bolao_definition_id = $1
        AND status = 'paid'`,
    [definitionId],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function countParticipantsForDefinition(definitionId: string): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(DISTINCT user_id)::int AS count
       FROM tickets
      WHERE bolao_definition_id = $1
        AND status = 'paid'`,
    [definitionId],
  );
  return Number(rows[0]?.count ?? 0);
}
