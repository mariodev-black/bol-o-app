import "server-only";

import {
  getAllSyncedCompetitionIds,
  getFootballMainCompetitionId,
} from "@/lib/boloes-extra-config";
import {
  partidaRecordToPalpiteAbertoMatch,
  pickPalpitesAbertosForHome,
  type PalpiteAbertoMatch,
} from "@/lib/home-palpites-abertos";
import { readMatchesCache } from "@/lib/matches-cache";
import { rowToPartidaPayload } from "@/lib/partidas-cache-payload";
import { bootstrapCompetitionCacheIfEmpty } from "@/lib/football/sync-orchestrator";

export async function loadHomePalpitesAbertosFromCache(
  limit = 2,
): Promise<PalpiteAbertoMatch[]> {
  try {
    await bootstrapCompetitionCacheIfEmpty(getFootballMainCompetitionId());
  } catch {
    /* cache pode já existir */
  }

  const idSet = new Set(getAllSyncedCompetitionIds());
  const rows = (await readMatchesCache()).filter((r) =>
    idSet.has(Number(r.competition_id)),
  );

  const matches: PalpiteAbertoMatch[] = [];
  for (const row of rows) {
    const mapped = partidaRecordToPalpiteAbertoMatch(rowToPartidaPayload(row));
    if (mapped) matches.push(mapped);
  }

  return pickPalpitesAbertosForHome(matches, limit);
}
