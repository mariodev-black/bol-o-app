/**
 * Downloads pontuais da API Futebol que NAO sao de partidas (partidas vivem em
 * `lib/football/provider.ts`).
 *
 * Hoje exporta apenas:
 *   - downloadStandingsJson — tabela do campeonato (usada pelo /api/tabela e
 *     pelo cron diario via `lib/football/sync-orchestrator`).
 */

/** GET /v1/campeonatos/{id}/tabela — JSON cru, sem normalizacao. */
export async function downloadStandingsJson(compId: string, apiToken: string): Promise<unknown> {
  const url = `https://api.api-futebol.com.br/v1/campeonatos/${compId}/tabela`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`tabela HTTP ${res.status}`);
  }
  return res.json();
}
