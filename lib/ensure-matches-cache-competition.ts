import { getAllSyncedCompetitionIds } from "@/lib/boloes-extra-config";
import { fetchProviderMatches } from "@/lib/football-api";
import { readMatchesCache, syncMatchesCache } from "@/lib/matches-cache";

/**
 * Se `matches_cache` estiver vazio para o campeonato, busca `/campeonatos/{id}/partidas` na API-Futebol
 * e grava no Postgres (mesmo fluxo do cron). Só para ids em `getAllSyncedCompetitionIds()` e com token.
 */
export async function ensureMatchesCacheForCompetition(competitionId: number): Promise<void> {
  const token = (process.env.FOOTBALL_API_TOKEN || "").trim();
  if (!token) return;
  if (!Number.isFinite(competitionId) || competitionId <= 0) return;
  if (!getAllSyncedCompetitionIds().includes(competitionId)) return;

  const rows = await readMatchesCache().catch(() => []);
  const count = rows.filter((r) => Number(r.competition_id) === competitionId).length;
  if (count > 0) return;

  await syncMatchesCache({
    force: true,
    fetchProviderMatches: async () => {
      const chunk = await fetchProviderMatches(String(competitionId));
      return chunk.map((m) => ({ ...m, competitionId }));
    },
  });
}
