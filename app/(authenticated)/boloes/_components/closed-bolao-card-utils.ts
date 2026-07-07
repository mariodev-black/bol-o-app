import type { ActiveBolaoListItem } from "@/app/(authenticated)/boloes/BoloesClient";
import { resolveBolaoListItemLogoSrc } from "@/app/(authenticated)/boloes/_components/BolaoListItemLogo";
import { ARTILHEIROS_BOLAO_SUBTITLE, ARTILHEIROS_BOLAO_TITLE } from "@/lib/artilheiros/config";
import { SHOWCASE_PRIZES } from "@/lib/boloes-prize-copy";
import type { BolaoDefinitionCatalogItem } from "@/lib/boloes/definitions/types";

function parseExtraTitle(title: string): { name: string; round: string | null } {
  const t = title.trim();
  if (!t.includes(" · ")) return { name: t, round: null };
  const [name, round] = t.split(" · ", 2);
  return { name: (name ?? t).trim(), round: round?.trim() || null };
}

function prizePoolLabelForActive(item: ActiveBolaoListItem): string {
  if (item.type === "dynamic") return "A definir";
  return SHOWCASE_PRIZES[item.type]?.total ?? "A definir";
}

function phaseLabelForActive(item: ActiveBolaoListItem): string | null {
  if (item.type === "extra") {
    return item.extraRoundLabel?.trim() || parseExtraTitle(item.title).round;
  }
  if (item.type === "diario") {
    return item.dailyEditionDatesLabel?.trim() || "Rodada do dia";
  }
  if (item.type === "artilheiros") {
    return item.subtitle?.trim() || ARTILHEIROS_BOLAO_SUBTITLE;
  }
  if (item.type === "principal") return "Copa do Mundo 2026";
  if (item.type === "dynamic") return item.subtitle?.trim() || null;
  return null;
}

function displayNameForActive(item: ActiveBolaoListItem): string {
  if (item.type === "principal") return "Bolão do Milhão";
  if (item.type === "diario") {
    return item.title || (item.isSkaleDaily ? "Bolão Diário Skale" : "Bolão Diário");
  }
  if (item.type === "artilheiros") {
    return item.title || ARTILHEIROS_BOLAO_TITLE;
  }
  if (item.type === "extra") {
    return parseExtraTitle(item.title).name;
  }
  return item.title;
}

function lifecycleStatusForActive(
  item: ActiveBolaoListItem,
): BolaoDefinitionCatalogItem["lifecycleStatus"] {
  if (item.displayPhase === "finalizado") return "encerrado";
  if (item.displayPhase === "disputa") return "ao_vivo";
  return "aberto";
}

/** Converte cota/bolão legado no shape mínimo do card padrão v2. */
export function catalogItemFromActiveBolao(
  item: ActiveBolaoListItem,
): BolaoDefinitionCatalogItem {
  const logoSrc = resolveBolaoListItemLogoSrc(item);
  const displayName = displayNameForActive(item);
  const phase = phaseLabelForActive(item);

  return {
    id: item.bolaoDefinitionId ?? item.id,
    slug: item.id,
    displayName,
    subtitle: phase,
    description: null,
    ticketType: item.type === "diario" ? "daily" : item.type === "extra" ? "extra" : "general",
    competitionId: item.championshipId ?? 0,
    competitionIds: item.championshipId != null ? [item.championshipId] : [],
    scopeMode: "full_competition",
    scopeDates: [],
    scopeMatchIds: [],
    scopeConfig: { competitions: [] },
    roundNumber: null,
    editionNumber: null,
    unitPriceCents: 0,
    saleEnabled: false,
    shopVisible: false,
    sortOrder: 0,
    logoUrl: typeof logoSrc === "string" ? logoSrc : null,
    bannerUrl: null,
    logoVariant: item.resolvedIconVariant ?? null,
    useCompetitionLogo: false,
    prizePoolBps: 0,
    prizeTiers: [],
    scoringConfig: {},
    startsAt: null,
    endsAt: null,
    settlementAt: null,
    prizeReleaseAt: null,
    maxTicketsPerUser: null,
    lifecycleStatus: lifecycleStatusForActive(item),
    metadata: {},
    enabled: true,
    createdAt: "",
    updatedAt: "",
    competitionDisplayName: displayName,
    competitionDisplayNames: [displayName],
    resolvedLogoUrl: typeof logoSrc === "string" ? logoSrc : null,
    resolvedBannerUrl: null,
    resolvedIconVariant: item.resolvedIconVariant ?? "generic",
    datesLabel: phase,
    priceLabel: "—",
    estimatedPrizeLabel: prizePoolLabelForActive(item),
    participantCount: item.participantCount ?? 0,
    matchCount: item.gamesCount ?? item.total ?? 0,
    remainingMatches: 0,
    purchaseOpen: item.displayPhase !== "finalizado",
    countdownToStartMs: null,
    countdownToEndMs: null,
  };
}

/** Compatibilidade: encerrados usam o mesmo conversor base. */
export function catalogItemFromFinishedActive(
  item: ActiveBolaoListItem,
): BolaoDefinitionCatalogItem {
  return {
    ...catalogItemFromActiveBolao(item),
    lifecycleStatus: "encerrado",
    purchaseOpen: false,
    remainingMatches: 0,
  };
}
