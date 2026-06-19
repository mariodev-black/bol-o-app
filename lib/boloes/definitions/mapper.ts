import type {
  BolaoDefinition,
  BolaoDefinitionInput,
  BolaoPrizeTier,
} from "@/lib/boloes/definitions/types";

type DbRow = {
  id: string;
  slug: string;
  display_name: string;
  subtitle: string | null;
  ticket_type: BolaoDefinition["ticketType"];
  competition_id: number;
  scope_mode: BolaoDefinition["scopeMode"];
  scope_dates: string[] | null;
  round_number: number | null;
  edition_number: number | null;
  unit_price_cents: number;
  sale_enabled: boolean;
  shop_visible: boolean;
  sort_order: number;
  logo_url: string | null;
  logo_variant: string | null;
  use_competition_logo: boolean;
  prize_pool_bps: number;
  prize_tiers: unknown;
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

export function mapBolaoDefinitionRow(row: DbRow): BolaoDefinition {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    subtitle: row.subtitle,
    ticketType: row.ticket_type,
    competitionId: Number(row.competition_id),
    scopeMode: row.scope_mode,
    scopeDates: Array.isArray(row.scope_dates) ? row.scope_dates.filter(Boolean) : [],
    roundNumber: row.round_number != null ? Number(row.round_number) : null,
    editionNumber: row.edition_number != null ? Number(row.edition_number) : null,
    unitPriceCents: Number(row.unit_price_cents) || 0,
    saleEnabled: Boolean(row.sale_enabled),
    shopVisible: Boolean(row.shop_visible),
    sortOrder: Number(row.sort_order) || 0,
    logoUrl: row.logo_url,
    logoVariant: row.logo_variant,
    useCompetitionLogo: Boolean(row.use_competition_logo),
    prizePoolBps: Number(row.prize_pool_bps) || 6000,
    prizeTiers: parsePrizeTiers(row.prize_tiers),
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    enabled: Boolean(row.enabled),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function normalizeBolaoDefinitionInput(input: BolaoDefinitionInput): {
  slug: string;
  displayName: string;
  subtitle: string | null;
  ticketType: BolaoDefinition["ticketType"];
  competitionId: number;
  scopeMode: BolaoDefinition["scopeMode"];
  scopeDates: string[];
  roundNumber: number | null;
  editionNumber: number | null;
  unitPriceCents: number;
  saleEnabled: boolean;
  shopVisible: boolean;
  sortOrder: number;
  logoUrl: string | null;
  logoVariant: string | null;
  useCompetitionLogo: boolean;
  prizePoolBps: number;
  prizeTiers: BolaoPrizeTier[];
  metadata: Record<string, unknown>;
  enabled: boolean;
} {
  const displayName = String(input.displayName ?? "").trim();
  if (!displayName) throw new Error("Nome do bolão é obrigatório");

  const competitionId = Number(input.competitionId);
  if (!Number.isFinite(competitionId) || competitionId <= 0) {
    throw new Error("Campeonato inválido");
  }

  const unitPriceCents = Math.max(0, Math.trunc(Number(input.unitPriceCents) || 0));
  const scopeDates = (input.scopeDates ?? [])
    .map((d) => String(d).trim())
    .filter((d) => /^\d{2}\/\d{2}\/\d{4}$/.test(d));

  if (input.scopeMode === "daily_dates" && scopeDates.length === 0) {
    throw new Error("Selecione ao menos um dia para o bolão diário");
  }
  if (input.scopeMode === "round") {
    const round = Number(input.roundNumber);
    if (!Number.isFinite(round) || round <= 0) {
      throw new Error("Informe a rodada do bolão");
    }
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

  return {
    slug,
    displayName,
    subtitle: input.subtitle?.trim() ? input.subtitle.trim() : null,
    ticketType: input.ticketType,
    competitionId,
    scopeMode: input.scopeMode,
    scopeDates,
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
    logoVariant: input.logoVariant?.trim() ? input.logoVariant.trim() : null,
    useCompetitionLogo: input.useCompetitionLogo !== false,
    prizePoolBps,
    prizeTiers,
    metadata: input.metadata ?? {},
    enabled: input.enabled !== false,
  };
}
