import { downloadStandingsJson } from "@/lib/football-external-downloads";
import { getAllSyncedCompetitionIds } from "@/lib/boloes-extra-config";
import { standingsCacheKey, upsertFootballApiCache } from "@/lib/football-api-cache-store";

/** Um GET /tabela por campeonato (principal + extras em env) — usar apos salvar palpite ou rotas leves. */
export async function refreshStandingsFromApiOnce(): Promise<boolean> {
  const apiToken = (process.env.FOOTBALL_API_TOKEN || "").trim();
  if (!apiToken) return false;
  try {
    for (const compNum of getAllSyncedCompetitionIds()) {
      const standings = await downloadStandingsJson(String(compNum), apiToken);
      await upsertFootballApiCache(standingsCacheKey(compNum), compNum, standings);
    }
    return true;
  } catch {
    return false;
  }
}
