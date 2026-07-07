import "server-only";
import { unstable_cache } from "next/cache";

import {
  getAllSyncedCompetitionIds,
} from "@/lib/boloes-extra-config";
import {
  partidaRecordToPalpiteAbertoMatch,
  pickPalpitesAbertosForHome,
  type PalpiteAbertoMatch,
} from "@/lib/home-palpites-abertos";
import { readMatchesCache } from "@/lib/matches-cache";
import { rowToPartidaPayload } from "@/lib/partidas-cache-payload";

async function loadHomePalpitesAbertosFromCacheUncached(
  limit = 2,
): Promise<PalpiteAbertoMatch[]> {
  const competitionIds = [...new Set(getAllSyncedCompetitionIds())];
  const rows = await readMatchesCache({ competitionIds });

  const matches: PalpiteAbertoMatch[] = [];
  for (const row of rows) {
    const mapped = partidaRecordToPalpiteAbertoMatch(rowToPartidaPayload(row));
    if (mapped) matches.push(mapped);
  }

  return pickPalpitesAbertosForHome(matches, limit);
}

export async function loadHomePalpitesAbertosFromCache(
  limit = 2,
): Promise<PalpiteAbertoMatch[]> {
  const cached = unstable_cache(
    () => loadHomePalpitesAbertosFromCacheUncached(limit),
    ["home", "palpites-abertos", String(limit)],
    { revalidate: 30, tags: ["matches-cache"] },
  );
  return cached();
}
