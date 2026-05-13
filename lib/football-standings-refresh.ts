import { downloadStandingsJson } from "@/lib/football-external-downloads";
import { standingsCacheKey, upsertFootballApiCache } from "@/lib/football-api-cache-store";

/** Um GET /tabela na API — usar apos salvar palpite ou rotas leves; nao dispara lista de rodadas/fases. */
export async function refreshStandingsFromApiOnce(): Promise<boolean> {
  const apiToken = (process.env.FOOTBALL_API_TOKEN || "").trim();
  if (!apiToken) return false;
  const compStr = (process.env.FOOTBALL_COMPETITION_ID || "72").trim();
  const compNum = Number.parseInt(compStr, 10) || 72;
  try {
    const standings = await downloadStandingsJson(compStr, apiToken);
    await upsertFootballApiCache(standingsCacheKey(compNum), compNum, standings);
    return true;
  } catch {
    return false;
  }
}
