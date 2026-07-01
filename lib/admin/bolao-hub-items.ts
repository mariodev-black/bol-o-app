import { enrichBolaoDefinitionCatalog } from "@/lib/boloes/definitions/branding";
import {
  buildLifecycleContext,
  computeBolaoLifecycleStatus,
} from "@/lib/boloes/definitions/lifecycle";
import { isLegacyBolaoDefinition } from "@/lib/boloes/definitions/legacy-bolao";
import { loadPrizeReleasedDefinitionIds } from "@/lib/boloes/definitions/prize-released-ids";
import { getBolaoDefinitionById } from "@/lib/boloes/definitions/repository";
import { scopeMatchesForBolaoDefinition } from "@/lib/boloes/definitions/scope";
import {
  getBolaoDefinitionStats,
  listBolaoDefinitionsWithStats,
} from "@/lib/boloes/definitions/stats";
import type {
  AdminBolaoHubItem,
  BolaoDefinitionWithStats,
} from "@/lib/boloes/definitions/types";
import { fetchMatchesMap } from "@/lib/football-api";
import { buildAdminBolaoHubLegacyItems } from "@/lib/admin/bolao-hub-legacy-items";
import { applyAdminBolaoHubLogo } from "@/lib/admin/bolao-hub-logo";

async function enrichAdminBolaoHubItems(
  items: BolaoDefinitionWithStats[],
  matches: Awaited<ReturnType<typeof fetchMatchesMap>>,
  prizeReleased: Set<string>,
): Promise<AdminBolaoHubItem[]> {
  if (items.length === 0) return [];

  const enriched = await enrichBolaoDefinitionCatalog(items);
  const enrichedById = new Map(enriched.map((item) => [item.id, item]));

  return items.map((def) => {
    const branding = enrichedById.get(def.id)!;
    const ctx = buildLifecycleContext(def, matches, {
      prizesReleased: prizeReleased.has(def.id),
    });
    const computedStatus = computeBolaoLifecycleStatus(def, ctx);
    const scoped = scopeMatchesForBolaoDefinition(def, matches);

    return applyAdminBolaoHubLogo({
      ...def,
      resolvedLogoUrl: branding.resolvedLogoUrl,
      resolvedIconVariant: branding.resolvedIconVariant,
      computedStatus,
      datesLabel: branding.datesLabel,
      competitionDisplayName: branding.competitionDisplayName,
      matchCount: scoped.length,
    });
  });
}

export async function buildAdminBolaoHubItems(): Promise<AdminBolaoHubItem[]> {
  const [dynamicItems, legacyItems] = await Promise.all([
    buildDynamicAdminBolaoHubItems(),
    buildAdminBolaoHubLegacyItems(),
  ]);

  const legacyCompetitionIds = new Set(
    legacyItems.map((item) => item.competitionId),
  );

  const filteredDynamic = dynamicItems.filter((item) => {
    if (!isLegacyBolaoDefinition(item)) return true;
    return !legacyCompetitionIds.has(item.competitionId);
  });

  return [...legacyItems, ...filteredDynamic].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}

async function buildDynamicAdminBolaoHubItems(): Promise<AdminBolaoHubItem[]> {
  const items = await listBolaoDefinitionsWithStats({ includeDisabled: true });
  if (items.length === 0) return [];

  const [matches, prizeReleased] = await Promise.all([
    fetchMatchesMap(),
    loadPrizeReleasedDefinitionIds(items.map((item) => item.id)),
  ]);

  const enriched = await enrichAdminBolaoHubItems(items, matches, prizeReleased);
  return enriched.map((item) => ({
    ...item,
    isLegacy: isLegacyBolaoDefinition(item) ? true : undefined,
  }));
}

export async function buildSingleAdminBolaoHubItem(
  id: string,
): Promise<AdminBolaoHubItem | null> {
  const [definition, stats] = await Promise.all([
    getBolaoDefinitionById(id),
    getBolaoDefinitionStats(id),
  ]);
  if (!definition || !stats) return null;

  const base: BolaoDefinitionWithStats = { ...definition, ...stats };
  const [matches, prizeReleased] = await Promise.all([
    fetchMatchesMap(),
    loadPrizeReleasedDefinitionIds([id]),
  ]);

  const [item] = await enrichAdminBolaoHubItems([base], matches, prizeReleased);
  return item ?? null;
}
