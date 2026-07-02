import {
  getExtraBolaoHeroSideVariant,
  resolveExtraBolaoDisplayName,
} from "@/lib/boloes-extra-competition-branding";
import { formatDailyEditionDatesLabel } from "@/lib/boloes/daily-editions";
import type {
  BolaoDefinition,
  BolaoDefinitionCatalogItem,
} from "@/lib/boloes/definitions/types";
import { getPool } from "@/lib/db";
import { readCompetitionDisplayNamesFromDb } from "@/lib/competition-metadata-cache";

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function datesLabelFromScope(def: BolaoDefinition): string | null {
  if (def.scopeMode === "custom_matches" && def.scopeMatchIds.length > 0) {
    return `${def.scopeMatchIds.length} jogo(s)`;
  }
  if (def.scopeMode === "multi_competition" && def.scopeConfig.competitions.length > 0) {
    const parts = def.scopeConfig.competitions.map((c) => {
      if (c.matchIds?.length) return `${c.matchIds.length} jogo(s)`;
      if (c.scopeDates?.length) return c.scopeDates.join(", ");
      if (c.roundNumber) return `rodada ${c.roundNumber}`;
      return "campeonato";
    });
    return parts.join(" · ");
  }
  if (def.scopeMode !== "daily_dates" || def.scopeDates.length === 0) return null;
  const sorted = [...def.scopeDates].sort();
  if (sorted.length === 1) {
    return `dia ${sorted[0]}`;
  }
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  return `dias ${first}${sorted.length > 2 ? ` a ${last}` : ` e ${last}`}`;
}

export async function resolveBolaoDefinitionBranding(
  def: BolaoDefinition,
  competitionLabels?: Record<number, string>,
): Promise<{
  competitionDisplayName: string;
  competitionDisplayNames: string[];
  resolvedLogoUrl: string | null;
  resolvedBannerUrl: string | null;
  resolvedIconVariant: string;
}> {
  const compIds = def.competitionIds.length > 0 ? def.competitionIds : [def.competitionId];
  const labels =
    competitionLabels ??
    (await readCompetitionDisplayNamesFromDb(compIds).catch(
      () => ({} as Record<number, string>),
    ));

  const competitionDisplayNames = compIds.map(
    (id) => labels[id] ?? resolveExtraBolaoDisplayName(id, def.displayName),
  );
  const competitionDisplayName = competitionDisplayNames.join(" · ");

  const iconVariant =
    def.logoVariant?.trim() ||
    getExtraBolaoHeroSideVariant(def.competitionId, competitionDisplayName);

  let resolvedLogoUrl: string | null = null;
  if (def.logoUrl) {
    resolvedLogoUrl = def.logoUrl;
  } else if (def.useCompetitionLogo) {
    const pool = getPool();
    const { rows } = await pool.query<{ logo: string | null }>(
      `SELECT logo FROM championships_cache WHERE competition_id = $1 LIMIT 1`,
      [def.competitionId],
    );
    resolvedLogoUrl = rows[0]?.logo?.trim() ? rows[0].logo!.trim() : null;
  }

  const resolvedBannerUrl = def.bannerUrl?.trim() ? def.bannerUrl.trim() : null;

  return {
    competitionDisplayName,
    competitionDisplayNames,
    resolvedLogoUrl,
    resolvedBannerUrl,
    resolvedIconVariant: iconVariant,
  };
}

export async function enrichBolaoDefinitionCatalog(
  definitions: BolaoDefinition[],
): Promise<BolaoDefinitionCatalogItem[]> {
  const ids = [...new Set(definitions.flatMap((d) => d.competitionIds.length ? d.competitionIds : [d.competitionId]))];
  const labels = await readCompetitionDisplayNamesFromDb(ids).catch(
    () => ({} as Record<number, string>),
  );

  const out: BolaoDefinitionCatalogItem[] = [];
  for (const def of definitions) {
    const branding = await resolveBolaoDefinitionBranding(def, labels);
    out.push({
      ...def,
      ...branding,
      datesLabel: datesLabelFromScope(def),
      priceLabel: formatBRL(def.unitPriceCents),
      estimatedPrizeLabel: null,
      participantCount: 0,
      matchCount: 0,
      remainingMatches: 0,
      purchaseOpen: def.saleEnabled,
      countdownToStartMs: null,
      countdownToEndMs: null,
    });
  }
  return out;
}

export { formatDailyEditionDatesLabel };
