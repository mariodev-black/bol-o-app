import { parseExtraBolaoScopeKey } from "@/lib/admin/boloes-ranking-types";
import { getAdminBoloesDashboardData, type AdminExtraBolaoCard } from "@/lib/admin/sections";
import {
  getExtraBolaoHeroSideVariant,
  resolveExtraBolaoDisplayName,
} from "@/lib/boloes-extra-competition-branding";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import {
  buildLifecycleContext,
  computeBolaoLifecycleStatus,
} from "@/lib/boloes/definitions/lifecycle";
import { resolveBolaoDefinitionBranding } from "@/lib/boloes/definitions/branding";
import { scopeMatchesForBolaoDefinition } from "@/lib/boloes/definitions/scope";
import type {
  AdminBolaoHubItem,
  BolaoDefinition,
  BolaoDefinitionWithStats,
} from "@/lib/boloes/definitions/types";
import {
  SKALE_BOLAO_DISPLAY_NAME,
  SKALE_BOLAO_SUBTITLE,
  getSkaleBolaoCompetitionId,
  getSkaleBolaoUnitCents,
  isSkaleBolaoEnabled,
} from "@/lib/boloes/skale-config";
import {
  SKALE_DAILY_BOLAO_DISPLAY_NAME,
  SKALE_DAILY_BOLAO_SUBTITLE,
  getSkaleDailyBolaoCompetitionId,
  getSkaleDailyBolaoUnitCents,
  isSkaleDailyBolaoEnabled,
  skaleDailyEditionCardTitle,
} from "@/lib/boloes/skale-daily-config";
import { getArtilheirosTicketPriceCents } from "@/lib/artilheiros/config";
import { getPool } from "@/lib/db";
import { fetchMatchesMap } from "@/lib/football-api";
import {
  getExtraBolaoUnitCentsForChampionship,
  getTicketPriceCents,
} from "@/lib/payments/ticket-config";
import { applyAdminBolaoHubLogo } from "@/lib/admin/bolao-hub-logo";

const LEGACY_NOW = () => new Date().toISOString();

function emptyStats() {
  return {
    ticketsPaid: 0,
    ticketsPending: 0,
    revenueCents: 0,
    participants: 0,
    predictionsCount: 0,
  };
}

function baseLegacyDefinition(
  id: string,
  partial: Pick<
    BolaoDefinition,
    | "slug"
    | "displayName"
    | "subtitle"
    | "ticketType"
    | "competitionId"
    | "scopeMode"
    | "unitPriceCents"
    | "logoVariant"
  > &
    Partial<BolaoDefinition>,
): BolaoDefinition {
  const now = LEGACY_NOW();
  return {
    id,
    slug: partial.slug,
    displayName: partial.displayName,
    subtitle: partial.subtitle ?? null,
    description: null,
    ticketType: partial.ticketType,
    competitionId: partial.competitionId,
    competitionIds: partial.competitionIds ?? [partial.competitionId],
    scopeMode: partial.scopeMode,
    scopeDates: partial.scopeDates ?? [],
    scopeMatchIds: partial.scopeMatchIds ?? [],
    scopeConfig: partial.scopeConfig ?? { competitions: [] },
    roundNumber: partial.roundNumber ?? null,
    editionNumber: partial.editionNumber ?? null,
    unitPriceCents: partial.unitPriceCents,
    saleEnabled: partial.saleEnabled ?? true,
    shopVisible: partial.shopVisible ?? true,
    sortOrder: partial.sortOrder ?? -100,
    logoUrl: partial.logoUrl ?? null,
    bannerUrl: null,
    logoVariant: partial.logoVariant ?? null,
    useCompetitionLogo: partial.useCompetitionLogo ?? false,
    prizePoolBps: partial.prizePoolBps ?? 6000,
    prizeTiers: partial.prizeTiers ?? [
      { rank: 1, poolBps: 5000 },
      { rank: 2, poolBps: 3000 },
      { rank: 3, poolBps: 2000 },
    ],
    scoringConfig: partial.scoringConfig ?? {},
    startsAt: partial.startsAt ?? null,
    endsAt: partial.endsAt ?? null,
    settlementAt: null,
    prizeReleaseAt: null,
    maxTicketsPerUser: null,
    lifecycleStatus: partial.lifecycleStatus ?? "aberto",
    metadata: { legacy: true, ...(partial.metadata ?? {}) },
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

async function countArtilheirosTickets(): Promise<{ tickets: number; players: number }> {
  const pool = getPool();
  const { rows } = await pool.query<{ tickets: string; players: string }>(
    `SELECT
       COUNT(*)::text AS tickets,
       COUNT(DISTINCT user_id)::text AS players
     FROM tickets
     WHERE ticket_type = 'artilheiros'
       AND status IN ('paid', 'approved')`,
  );
  return {
    tickets: Number(rows[0]?.tickets) || 0,
    players: Number(rows[0]?.players) || 0,
  };
}

function extraCardTitle(card: AdminExtraBolaoCard): string {
  const parsed = parseExtraBolaoScopeKey(card.key);
  if (parsed?.mode === "copa") return card.displayName;
  if (parsed?.mode === "skale-daily") {
    return skaleDailyEditionCardTitle(parsed.edition);
  }
  if (parsed?.mode === "round") return `Rodada ${parsed.rodada}`;
  return card.displayName;
}

function extraCardSubtitle(card: AdminExtraBolaoCard): string {
  const parsed = parseExtraBolaoScopeKey(card.key);
  if (parsed?.mode === "copa") return "Copa integral";
  if (parsed?.mode === "skale-daily") return SKALE_DAILY_BOLAO_SUBTITLE;
  if (parsed?.mode === "round") return `${card.displayName} — rodada ${parsed.rodada}`;
  return card.displayName;
}

async function enrichLegacyHubItem(
  def: BolaoDefinitionWithStats,
  detailHref: string,
  matches: Awaited<ReturnType<typeof fetchMatchesMap>>,
  datesLabel: string | null,
): Promise<AdminBolaoHubItem> {
  const branding = await resolveBolaoDefinitionBranding(def);
  const ctx = buildLifecycleContext(def, matches, { prizesReleased: false });
  const computedStatus = computeBolaoLifecycleStatus(def, ctx);
  const scoped = scopeMatchesForBolaoDefinition(def, matches);

  return applyAdminBolaoHubLogo({
    ...def,
    isLegacy: true,
    detailHref,
    resolvedLogoUrl: branding.resolvedLogoUrl,
    resolvedIconVariant: branding.resolvedIconVariant || def.logoVariant || "generic",
    computedStatus,
    datesLabel,
    competitionDisplayName: branding.competitionDisplayName,
    matchCount: scoped.length,
  });
}

function statsFromCounts(
  ticketsPaid: number,
  participants: number,
  unitPriceCents: number,
): ReturnType<typeof emptyStats> {
  return {
    ticketsPaid,
    ticketsPending: 0,
    revenueCents: ticketsPaid * unitPriceCents,
    participants,
    predictionsCount: 0,
  };
}

export async function buildAdminBolaoHubLegacyItems(): Promise<AdminBolaoHubItem[]> {
  const [dashboard, matches, artilheiros] = await Promise.all([
    getAdminBoloesDashboardData(),
    fetchMatchesMap(),
    countArtilheirosTickets(),
  ]);

  const mainComp = getFootballMainCompetitionId();
  const principalPrice = getTicketPriceCents("general");
  const dailyPrice = getTicketPriceCents("daily");
  const items: AdminBolaoHubItem[] = [];

  items.push(
    await enrichLegacyHubItem(
      {
        ...baseLegacyDefinition("legacy:principal", {
          slug: "bolao-principal",
          displayName: "Bolão Principal",
          subtitle: "Copa do Mundo — ranking geral",
          ticketType: "general",
          competitionId: mainComp,
          scopeMode: "full_competition",
          unitPriceCents: principalPrice,
          logoVariant: "copa_mundo",
          useCompetitionLogo: false,
        }),
        ...statsFromCounts(
          dashboard.principal.ticketsCount,
          dashboard.principal.playersCount,
          principalPrice,
        ),
      },
      "/admin/boloes/principal",
      matches,
      "Campeonato inteiro",
    ),
  );

  items.push(
    await enrichLegacyHubItem(
      {
        ...baseLegacyDefinition("legacy:artilheiros", {
          slug: "bolao-artilheiros",
          displayName: "Bolão dos Artilheiros",
          subtitle: "Top 3 artilheiros da Copa",
          ticketType: "extra",
          competitionId: mainComp,
          scopeMode: "full_competition",
          unitPriceCents: getArtilheirosTicketPriceCents(),
          logoVariant: "artilheiros",
          useCompetitionLogo: false,
        }),
        ...statsFromCounts(
          artilheiros.tickets,
          artilheiros.players,
          getArtilheirosTicketPriceCents(),
        ),
      },
      "/admin/boloes/artilheiros",
      matches,
      "Palpites de artilheiros",
    ),
  );

  items.push(
    await enrichLegacyHubItem(
      {
        ...baseLegacyDefinition("legacy:amistosos", {
          slug: "bolao-amistosos",
          displayName: "Bolão dos Amistosos",
          subtitle: "Placares manuais — amistosos pré-Copa",
          ticketType: "extra",
          competitionId: mainComp,
          scopeMode: "custom_matches",
          unitPriceCents: getExtraBolaoTicketUnitCentsFallback(),
          logoVariant: "amistosos",
          useCompetitionLogo: false,
        }),
        ...emptyStats(),
      },
      "/admin/boloes/amistosos",
      matches,
      "Amistosos",
    ),
  );

  for (const card of dashboard.dailyCards) {
    items.push(
      await enrichLegacyHubItem(
        {
          ...baseLegacyDefinition(`legacy:daily:${card.date}`, {
            slug: `bolao-diario-${card.date.replace(/\//g, "-")}`,
            displayName: `Bolão Diário — ${card.date}`,
            subtitle: "Palpites do dia",
            ticketType: "daily",
            competitionId: mainComp,
            scopeMode: "daily_dates",
            scopeDates: [card.date],
            unitPriceCents: dailyPrice,
            logoVariant: "daily",
            useCompetitionLogo: false,
          }),
          ...statsFromCounts(card.ticketsCount, card.playersCount, dailyPrice),
        },
        `/admin/boloes/diario?data=${encodeURIComponent(card.date)}`,
        matches,
        card.date,
      ),
    );
  }

  const skaleId = getSkaleBolaoCompetitionId();
  if (isSkaleBolaoEnabled()) {
    const skaleCopaKey = `${skaleId}:copa`;
    const skaleCard = dashboard.extraCards.find((c) => c.key === skaleCopaKey);
    const skaleTickets = skaleCard?.ticketsCount ?? 0;
    const skalePlayers = skaleCard?.playersCount ?? 0;

    items.push(
      await enrichLegacyHubItem(
        {
          ...baseLegacyDefinition(`legacy:${skaleCopaKey}`, {
            slug: "bolao-skale-integral",
            displayName: SKALE_BOLAO_DISPLAY_NAME,
            subtitle: SKALE_BOLAO_SUBTITLE,
            ticketType: "extra",
            competitionId: skaleId,
            scopeMode: "full_competition",
            unitPriceCents: getSkaleBolaoUnitCents(),
            logoVariant: "skale",
          }),
          ...statsFromCounts(skaleTickets, skalePlayers, getSkaleBolaoUnitCents()),
        },
        `/admin/boloes/extra?key=${encodeURIComponent(skaleCopaKey)}`,
        matches,
        "Copa integral",
      ),
    );
  }

  const skaleDailyId = getSkaleDailyBolaoCompetitionId();
  if (isSkaleDailyBolaoEnabled()) {
    const skaleDailyCards = dashboard.extraCards.filter((card) => {
      const parsed = parseExtraBolaoScopeKey(card.key);
      return parsed?.mode === "skale-daily" && parsed.championshipId === skaleDailyId;
    });

    for (const card of skaleDailyCards) {
      items.push(
        await enrichLegacyHubItem(
          {
            ...baseLegacyDefinition(`legacy:${card.key}`, {
              slug: `bolao-skale-diario-${card.rodada}`,
              displayName: `${SKALE_DAILY_BOLAO_DISPLAY_NAME} — ${extraCardTitle(card)}`,
              subtitle: SKALE_DAILY_BOLAO_SUBTITLE,
              ticketType: "extra",
              competitionId: skaleDailyId,
              scopeMode: "daily_dates",
              editionNumber: card.rodada,
              unitPriceCents: getSkaleDailyBolaoUnitCents(),
              logoVariant: "skale",
            }),
            ...statsFromCounts(card.ticketsCount, card.playersCount, getSkaleDailyBolaoUnitCents()),
          },
          `/admin/boloes/extra?key=${encodeURIComponent(card.key)}`,
          matches,
          extraCardSubtitle(card),
        ),
      );
    }
  }

  const handledExtraKeys = new Set<string>();
  if (isSkaleBolaoEnabled()) {
    handledExtraKeys.add(`${getSkaleBolaoCompetitionId()}:copa`);
  }
  if (isSkaleDailyBolaoEnabled()) {
    for (const card of dashboard.extraCards) {
      const parsed = parseExtraBolaoScopeKey(card.key);
      if (parsed?.mode === "skale-daily") handledExtraKeys.add(card.key);
    }
  }

  for (const card of dashboard.extraCards) {
    if (handledExtraKeys.has(card.key)) continue;

    const parsed = parseExtraBolaoScopeKey(card.key);
    if (!parsed || parsed.mode === "definition") continue;
    if (parsed.mode === "skale-daily") continue;
    if (parsed.mode === "copa" && parsed.championshipId === skaleId) continue;

    const href = `/admin/boloes/extra?key=${encodeURIComponent(card.key)}`;
    const displayName = resolveExtraBolaoDisplayName(card.championshipId, card.displayName);
    const iconVariant = getExtraBolaoHeroSideVariant(card.championshipId, displayName);
    const unitPrice = getExtraBolaoUnitCentsForChampionship(card.championshipId);

    items.push(
      await enrichLegacyHubItem(
        {
          ...baseLegacyDefinition(`legacy:${card.key}`, {
            slug: `bolao-extra-${card.key.replace(/[:]/g, "-")}`,
            displayName: `${displayName} — ${extraCardTitle(card)}`,
            subtitle: extraCardSubtitle(card),
            ticketType: "extra",
            competitionId: card.championshipId,
            scopeMode: parsed.mode === "copa" ? "full_competition" : "round",
            roundNumber: parsed.mode === "round" ? parsed.rodada : null,
            unitPriceCents: unitPrice,
            logoVariant: iconVariant,
          }),
          ...statsFromCounts(card.ticketsCount, card.playersCount, unitPrice),
        },
        href,
        matches,
        extraCardSubtitle(card),
      ),
    );
  }

  return items;
}

function getExtraBolaoTicketUnitCentsFallback(): number {
  const n = Number.parseInt(process.env.TICKET_PRICE_EXTRA_BOLAO_CENTS || "1000", 10);
  return Number.isFinite(n) && n > 0 ? n : 1000;
}
