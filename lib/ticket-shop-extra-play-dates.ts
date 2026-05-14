import { resolveDiarioPlayableDate } from "@/lib/diario-playable-date";
import { fetchMatchesMap } from "@/lib/football-api";

/**
 * Data da rodada “em aberto” por campeonato extra (mesma regra do bolão / palpites).
 */
export async function extraBolaoRoundPlayDatesByChampionship(
  championshipIds: number[]
): Promise<Record<number, string>> {
  const ids = [...new Set(championshipIds.filter((n) => Number.isFinite(n) && n > 0))];
  if (ids.length === 0) return {};
  const matches = await fetchMatchesMap({ ensureCompetitionIds: ids }).catch(() => new Map());
  const out: Record<number, string> = {};
  for (const id of ids) {
    try {
      const d = resolveDiarioPlayableDate(matches, { competitionId: id });
      if (d) out[id] = d;
    } catch {
      /* ignore */
    }
  }
  return out;
}
