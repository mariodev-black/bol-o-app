import { appendBolaoDefinitionAuditLog } from "@/lib/boloes/definitions/audit-log";
import {
  buildLifecycleContext,
  computeBolaoLifecycleStatus,
} from "@/lib/boloes/definitions/lifecycle";
import {
  areAllScopedMatchesFinished,
  isDefinitionReadyForSettlement,
} from "@/lib/boloes/definitions/settlement";
import { processDefinitionPrizeClosure } from "@/lib/boloes/definitions/prize-processor";
import {
  listBolaoDefinitions,
  updateBolaoLifecycleStatus,
} from "@/lib/boloes/definitions/repository";
import type { BolaoLifecycleStatus } from "@/lib/boloes/definitions/types";
import { fetchMatchesMap } from "@/lib/football-api";
import { getPool } from "@/lib/db";

export type BolaoLifecycleTickResult = {
  scanned: number;
  updated: number;
  prizesProcessed: number;
  transitions: Array<{ id: string; from: BolaoLifecycleStatus; to: BolaoLifecycleStatus }>;
};

async function loadPrizeReleasedIds(definitionIds: string[]): Promise<Set<string>> {
  if (definitionIds.length === 0) return new Set();
  const pool = getPool();
  const { rows } = await pool.query<{ id: string }>(
    `SELECT DISTINCT metadata->>'bolaoDefinitionId' AS id
       FROM prize_closures
      WHERE metadata->>'bolaoDefinitionId' = ANY($1::text[])
        AND processado = true`,
    [definitionIds],
  ).catch(() => ({ rows: [] as { id: string }[] }));
  return new Set(rows.map((r) => r.id).filter(Boolean));
}

/** Atualiza status automático de todos os bolões habilitados. */
export async function runBolaoLifecycleTick(): Promise<BolaoLifecycleTickResult> {
  const definitions = await listBolaoDefinitions({ includeDisabled: false });
  if (definitions.length === 0) {
    return { scanned: 0, updated: 0, prizesProcessed: 0, transitions: [] };
  }

  const matches = await fetchMatchesMap();
  const prizeReleased = await loadPrizeReleasedIds(definitions.map((d) => d.id));
  const transitions: BolaoLifecycleTickResult["transitions"] = [];
  let updated = 0;
  let prizesProcessed = 0;

  for (const def of definitions) {
    const ctx = buildLifecycleContext(def, matches, {
      prizesReleased: prizeReleased.has(def.id),
      rankingPublished: def.lifecycleStatus === "finalizado",
    });
    const next = computeBolaoLifecycleStatus(def, ctx);
    if (next !== def.lifecycleStatus) {
      await updateBolaoLifecycleStatus(def.id, next);
      await appendBolaoDefinitionAuditLog({
        bolaoDefinitionId: def.id,
        action: "lifecycle_transition",
        payload: { from: def.lifecycleStatus, to: next },
      });
      transitions.push({ id: def.id, from: def.lifecycleStatus, to: next });
      updated += 1;
    }

    if (
      next === "encerrado" ||
      next === "finalizado" ||
      areAllScopedMatchesFinished(ctx.scopedMatches)
    ) {
      const ready = isDefinitionReadyForSettlement(def, ctx.scopedMatches);
      if (ready) {
        const processed = await processDefinitionPrizeClosure(def, matches).catch(() => false);
        if (processed) prizesProcessed += 1;
      }
    }
  }

  return {
    scanned: definitions.length,
    updated,
    prizesProcessed,
    transitions,
  };
}
