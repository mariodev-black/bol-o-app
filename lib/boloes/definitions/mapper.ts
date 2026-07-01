import type {
  BolaoCompetitionScopeRule,
  BolaoDefinition,
  BolaoDefinitionInput,
  BolaoLifecycleStatus,
  BolaoPrizeTier,
  BolaoScopeConfig,
  BolaoScoringConfig,
} from "@/lib/boloes/definitions/types";

type DbRow = {
  id: string;
  slug: string;
  display_name: string;
  subtitle: string | null;
  description: string | null;
  ticket_type: BolaoDefinition["ticketType"];
  competition_id: number;
  competition_ids: number[] | null;
  scope_mode: BolaoDefinition["scopeMode"];
  scope_dates: string[] | null;
  scope_match_ids: Array<number | string> | null;
  scope_config: unknown;
  round_number: number | null;
  edition_number: number | null;
  unit_price_cents: number;
  sale_enabled: boolean;
  shop_visible: boolean;
  sort_order: number;
  logo_url: string | null;
  banner_url: string | null;
  logo_variant: string | null;
  use_competition_logo: boolean;
  prize_pool_bps: number;
  prize_tiers: unknown;
  scoring_config: unknown;
  starts_at: Date | null;
  ends_at: Date | null;
  settlement_at: Date | null;
  prize_release_at: Date | null;
  max_tickets_per_user: number | null;
  lifecycle_status: BolaoLifecycleStatus;
  metadata: unknown;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

export function slugifyBolaoName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parsePrizeTiers(raw: unknown): BolaoPrizeTier[] {
  if (!Array.isArray(raw)) {
    return [
      { rank: 1, poolBps: 5000 },
      { rank: 2, poolBps: 3000 },
      { rank: 3, poolBps: 2000 },
    ];
  }
  return raw
    .map((item) => {
      const o = item as Record<string, unknown>;
      const rank = Number(o.rank);
      const poolBps = Number(o.poolBps ?? o.pool_bps);
      if (!Number.isFinite(rank) || rank <= 0 || !Number.isFinite(poolBps) || poolBps < 0) {
        return null;
      }
      return { rank: Math.trunc(rank), poolBps: Math.trunc(poolBps) };
    })
    .filter((x): x is BolaoPrizeTier => x != null)
    .sort((a, b) => a.rank - b.rank);
}

function parseScopeConfig(raw: unknown): BolaoScopeConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { competitions: [] };
  }
  const o = raw as Record<string, unknown>;
  const competitionsRaw = o.competitions;
  if (!Array.isArray(competitionsRaw)) return { competitions: [] };
  const competitions: BolaoCompetitionScopeRule[] = [];
  for (const item of competitionsRaw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const competitionId = Number(r.competitionId ?? r.competition_id);
    if (!Number.isFinite(competitionId) || competitionId <= 0) continue;
    const mode = String(r.mode ?? "all_matches") as BolaoCompetitionScopeRule["mode"];
    const scopeDates = Array.isArray(r.scopeDates)
      ? r.scopeDates.map((d) => String(d).trim()).filter(Boolean)
      : undefined;
    const matchIds = Array.isArray(r.matchIds)
      ? r.matchIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      : undefined;
    competitions.push({
      competitionId,
      mode,
      scopeDates,
      roundNumber:
        r.roundNumber != null && Number.isFinite(Number(r.roundNumber))
          ? Math.trunc(Number(r.roundNumber))
          : null,
      matchIds,
    });
  }
  return { competitions };
}

function parseScoringConfig(raw: unknown): BolaoScoringConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as BolaoScoringConfig;
}

function parseIsoDate(value: Date | null | undefined): string | null {
  if (!value) return null;
  const t = value instanceof Date ? value : new Date(value);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

export function mapBolaoDefinitionRow(row: DbRow): BolaoDefinition {
  const competitionIds =
    Array.isArray(row.competition_ids) && row.competition_ids.length > 0
      ? row.competition_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      : [Number(row.competition_id)];

  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    subtitle: row.subtitle,
    description: row.description,
    ticketType: row.ticket_type,
    competitionId: Number(row.competition_id),
    competitionIds,
    scopeMode: row.scope_mode,
    scopeDates: Array.isArray(row.scope_dates) ? row.scope_dates.filter(Boolean) : [],
    scopeMatchIds: Array.isArray(row.scope_match_ids)
      ? row.scope_match_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      : [],
    scopeConfig: parseScopeConfig(row.scope_config),
    roundNumber: row.round_number != null ? Number(row.round_number) : null,
    editionNumber: row.edition_number != null ? Number(row.edition_number) : null,
    unitPriceCents: Number(row.unit_price_cents) || 0,
    saleEnabled: Boolean(row.sale_enabled),
    shopVisible: Boolean(row.shop_visible),
    sortOrder: Number(row.sort_order) || 0,
    logoUrl: row.logo_url,
    bannerUrl: row.banner_url,
    logoVariant: row.logo_variant,
    useCompetitionLogo: Boolean(row.use_competition_logo),
    prizePoolBps: Number(row.prize_pool_bps) || 6000,
    prizeTiers: parsePrizeTiers(row.prize_tiers),
    scoringConfig: parseScoringConfig(row.scoring_config),
    startsAt: parseIsoDate(row.starts_at),
    endsAt: parseIsoDate(row.ends_at),
    settlementAt: parseIsoDate(row.settlement_at),
    prizeReleaseAt: parseIsoDate(row.prize_release_at),
    maxTicketsPerUser:
      row.max_tickets_per_user != null ? Number(row.max_tickets_per_user) : null,
    lifecycleStatus: row.lifecycle_status ?? "programado",
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    enabled: Boolean(row.enabled),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function parseOptionalIso(input: string | null | undefined): Date | null {
  if (!input?.trim()) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizeBolaoDefinitionInput(input: BolaoDefinitionInput): {
  slug: string;
  displayName: string;
  subtitle: string | null;
  description: string | null;
  ticketType: BolaoDefinition["ticketType"];
  competitionId: number;
  competitionIds: number[];
  scopeMode: BolaoDefinition["scopeMode"];
  scopeDates: string[];
  scopeMatchIds: number[];
  scopeConfig: BolaoScopeConfig;
  roundNumber: number | null;
  editionNumber: number | null;
  unitPriceCents: number;
  saleEnabled: boolean;
  shopVisible: boolean;
  sortOrder: number;
  logoUrl: string | null;
  bannerUrl: string | null;
  logoVariant: string | null;
  useCompetitionLogo: boolean;
  prizePoolBps: number;
  prizeTiers: BolaoPrizeTier[];
  scoringConfig: BolaoScoringConfig;
  startsAt: Date | null;
  endsAt: Date | null;
  settlementAt: Date | null;
  prizeReleaseAt: Date | null;
  maxTicketsPerUser: number | null;
  lifecycleStatus: BolaoLifecycleStatus;
  metadata: Record<string, unknown>;
  enabled: boolean;
} {
  const displayName = String(input.displayName ?? "").trim();
  if (!displayName) throw new Error("Nome do bolão é obrigatório");

  const competitionId = Number(input.competitionId);
  if (!Number.isFinite(competitionId) || competitionId <= 0) {
    throw new Error("Campeonato inválido");
  }

  const competitionIds = (input.competitionIds?.length
    ? input.competitionIds
    : [competitionId]
  )
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (competitionIds.length === 0) {
    throw new Error("Selecione ao menos um campeonato");
  }

  const unitPriceCents = Math.max(0, Math.trunc(Number(input.unitPriceCents) || 0));
  const scopeDates = (input.scopeDates ?? [])
    .map((d) => String(d).trim())
    .filter((d) => /^\d{2}\/\d{2}\/\d{4}$/.test(d));

  const scopeMatchIds = (input.scopeMatchIds ?? [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);

  const scopeConfig = input.scopeConfig ?? { competitions: [] };

  if (input.scopeMode === "daily_dates" && scopeDates.length === 0 && scopeConfig.competitions.length === 0) {
    throw new Error("Selecione ao menos um dia para o bolão");
  }
  if (input.scopeMode === "round") {
    const round = Number(input.roundNumber);
    const hasRoundInConfig = scopeConfig.competitions.some((c) => (c.roundNumber ?? 0) > 0);
    if (!Number.isFinite(round) || round <= 0) {
      if (!hasRoundInConfig) throw new Error("Informe a rodada do bolão");
    }
  }
  if (input.scopeMode === "custom_matches" && scopeMatchIds.length === 0) {
    const hasMatchIds = scopeConfig.competitions.some((c) => (c.matchIds?.length ?? 0) > 0);
    if (!hasMatchIds) throw new Error("Selecione ao menos um jogo");
  }
  if (input.scopeMode === "multi_competition" && scopeConfig.competitions.length === 0) {
    throw new Error("Configure o escopo de cada campeonato");
  }

  const prizeTiers = parsePrizeTiers(input.prizeTiers);
  if (prizeTiers.length === 0) {
    throw new Error("Configure ao menos um tier de premiação");
  }

  const prizePoolBps = Math.min(
    10000,
    Math.max(0, Math.trunc(Number(input.prizePoolBps ?? 6000))),
  );

  const slugRaw = String(input.slug ?? "").trim() || slugifyBolaoName(displayName);
  const slug = slugRaw || `bolao-${Date.now()}`;

  const maxTicketsPerUser =
    input.maxTicketsPerUser != null && Number.isFinite(Number(input.maxTicketsPerUser))
      ? Math.max(1, Math.trunc(Number(input.maxTicketsPerUser)))
      : null;

  return {
    slug,
    displayName,
    subtitle: input.subtitle?.trim() ? input.subtitle.trim() : null,
    description: input.description?.trim() ? input.description.trim() : null,
    ticketType: input.ticketType,
    competitionId: competitionIds[0]!,
    competitionIds,
    scopeMode: input.scopeMode,
    scopeDates,
    scopeMatchIds,
    scopeConfig,
    roundNumber:
      input.roundNumber != null && Number.isFinite(Number(input.roundNumber))
        ? Math.trunc(Number(input.roundNumber))
        : null,
    editionNumber:
      input.editionNumber != null && Number.isFinite(Number(input.editionNumber))
        ? Math.trunc(Number(input.editionNumber))
        : null,
    unitPriceCents,
    saleEnabled: input.saleEnabled !== false,
    shopVisible: input.shopVisible !== false,
    sortOrder: Math.trunc(Number(input.sortOrder ?? 0)),
    logoUrl: input.logoUrl?.trim() ? input.logoUrl.trim() : null,
    bannerUrl: input.bannerUrl?.trim() ? input.bannerUrl.trim() : null,
    logoVariant: input.logoVariant?.trim() ? input.logoVariant.trim() : null,
    useCompetitionLogo: input.useCompetitionLogo !== false,
    prizePoolBps,
    prizeTiers,
    scoringConfig: input.scoringConfig ?? {},
    startsAt: parseOptionalIso(input.startsAt),
    endsAt: parseOptionalIso(input.endsAt),
    settlementAt: parseOptionalIso(input.settlementAt),
    prizeReleaseAt: parseOptionalIso(input.prizeReleaseAt),
    maxTicketsPerUser,
    lifecycleStatus: input.lifecycleStatus ?? "programado",
    metadata: input.metadata ?? {},
    enabled: input.enabled !== false,
  };
}
