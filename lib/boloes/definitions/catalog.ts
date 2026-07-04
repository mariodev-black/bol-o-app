import { unstable_cache } from "next/cache";
import { enrichBolaoDefinitionCatalog } from "@/lib/boloes/definitions/branding";
import {
  buildLifecycleContext,
  computeBolaoLifecycleStatus,
  isBolaoPurchaseOpen,
} from "@/lib/boloes/definitions/lifecycle";
import { loadStatsMap } from "@/lib/boloes/definitions/stats";
import { listBolaoDefinitionsForShop } from "@/lib/boloes/definitions/repository";
import { scopeMatchesForBolaoDefinition } from "@/lib/boloes/definitions/scope";
import type {
  BolaoCatalogSections,
  BolaoDefinitionCatalogItem,
} from "@/lib/boloes/definitions/types";
import { fetchMatchesMap } from "@/lib/football-api";
import { getPool } from "@/lib/db";

import { loadPrizeReleasedDefinitionIds } from "@/lib/boloes/definitions/prize-released-ids";
import { CLOSED_BOLAO_STATUSES } from "@/lib/boloes/definitions/lifecycle-labels";
import { estimatePrizePoolLabel } from "@/lib/boloes/definitions/prizes";

/** Vitrine de bolões — igual pra todo mundo, não depende de usuário. */
const CATALOG_REVALIDATE_SEC = 15;

export async function buildBolaoCatalogSections(): Promise<BolaoCatalogSections> {
  const getCached = unstable_cache(
    buildBolaoCatalogSectionsUncached,
    ["boloes", "catalog-sections"],
    { revalidate: CATALOG_REVALIDATE_SEC, tags: ["catalog"] },
  );
  return getCached();
}

async function buildBolaoCatalogSectionsUncached(): Promise<BolaoCatalogSections> {
  const definitions = await listBolaoDefinitionsForShop();
  if (definitions.length === 0) {
    return { upcoming: [], available: [], closed: [] };
  }

  const matches = await fetchMatchesMap();
  const enriched = await enrichBolaoDefinitionCatalog(definitions);
  const prizeReleased = await loadPrizeReleasedDefinitionIds(definitions.map((d) => d.id));
  const pool = getPool();
  const [participantRows, statsByDef] = await Promise.all([
    pool.query<{ bolao_definition_id: string; count: string }>(
      `SELECT bolao_definition_id, COUNT(DISTINCT user_id)::int AS count
         FROM tickets
        WHERE bolao_definition_id = ANY($1::uuid[])
          AND status = 'paid'
        GROUP BY bolao_definition_id`,
      [definitions.map((d) => d.id)],
    ),
    loadStatsMap(),
  ]);
  const participantsByDef = new Map(
    participantRows.rows.map((r) => [r.bolao_definition_id, Number(r.count) || 0]),
  );

  const nowMs = Date.now();
  const items: BolaoDefinitionCatalogItem[] = [];

  for (const base of enriched) {
    const def = definitions.find((d) => d.id === base.id)!;
    const scoped = scopeMatchesForBolaoDefinition(def, matches);
    const ctx = buildLifecycleContext(def, matches, {
      prizesReleased: prizeReleased.has(def.id),
    });
    const lifecycle = computeBolaoLifecycleStatus(def, ctx);
    const finished = scoped.filter(
      (m) => m.resultCasa != null && m.resultVisitante != null,
    ).length;
    const remaining = scoped.length - finished;
    const participants = participantsByDef.get(def.id) ?? 0;
    const stats = statsByDef.get(def.id);
    const revenueCents = stats?.revenueCents ?? 0;
    const estimatedPrizeLabel = estimatePrizePoolLabel(revenueCents, def.prizePoolBps);

    const startsAtMs = def.startsAt ? Date.parse(def.startsAt) : null;
    const endsAtMs = def.endsAt ? Date.parse(def.endsAt) : null;

    items.push({
      ...base,
      participantCount: participants,
      matchCount: scoped.length,
      remainingMatches: Math.max(0, remaining),
      purchaseOpen: isBolaoPurchaseOpen(def, lifecycle),
      estimatedPrizeLabel,
      countdownToStartMs:
        startsAtMs != null && startsAtMs > nowMs ? startsAtMs - nowMs : null,
      countdownToEndMs: endsAtMs != null && endsAtMs > nowMs ? endsAtMs - nowMs : null,
      lifecycleStatus: lifecycle,
    });
  }

  return {
    upcoming: items.filter((i) => i.lifecycleStatus === "programado"),
    available: items.filter(
      (i) => i.lifecycleStatus === "aberto" || i.lifecycleStatus === "ao_vivo",
    ),
    closed: items.filter((i) => CLOSED_BOLAO_STATUSES.has(i.lifecycleStatus)),
  };
}

export async function listBolaoCatalogItems(): Promise<BolaoDefinitionCatalogItem[]> {
  const sections = await buildBolaoCatalogSections();
  return [...sections.upcoming, ...sections.available, ...sections.closed];
}
