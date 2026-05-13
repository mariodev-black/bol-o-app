import { fetchFootballApiV1 } from "@/lib/football-api-fetch";
import type { ProviderMatch } from "@/lib/football-api";

type FaseListItem = { fase_id?: number; slug?: string; nome?: string };

function parseFasesListPayload(raw: unknown): FaseListItem[] {
  if (Array.isArray(raw)) return raw as FaseListItem[];
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const key of ["fases", "data", "items", "result"]) {
      const v = o[key];
      if (Array.isArray(v)) return v as FaseListItem[];
    }
  }
  return [];
}

/** GET /v1/campeonatos/{id}/tabela — só para job de snapshot (cron), não usar em request de usuário. */
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

/**
 * Lista fases + detalhe de cada uma; mesma lógica que existia no sync ao vivo.
 * Só para snapshot diário — N requisições por execução, não por visita à página.
 */
export async function downloadFasesEnrichmentMatches(compId: string, apiToken: string): Promise<ProviderMatch[]> {
  const listUrl = `https://api.api-futebol.com.br/v1/campeonatos/${compId}/fases`;
  const listRes = await fetchFootballApiV1(listUrl, {
    headers: { Authorization: `Bearer ${apiToken}` },
    cache: "no-store",
  });
  if (!listRes.ok) {
    throw new Error(`fases:list HTTP ${listRes.status}`);
  }
  const raw = await listRes.json().catch(() => null);
  const fasesList = parseFasesListPayload(raw);
  if (fasesList.length === 0) return [];

  const { collectProviderMatches } = await import("@/lib/football-api");
  const maxFases = Number.parseInt(process.env.FOOTBALL_FASES_SYNC_LIMIT ?? "32", 10) || 32;
  const byId = new Map<number, ProviderMatch>();
  for (const f of fasesList.slice(0, maxFases)) {
    const faseId = Number(f?.fase_id);
    if (!Number.isFinite(faseId)) continue;
    const detailUrl = `https://api.api-futebol.com.br/v1/campeonatos/${compId}/fases/${faseId}`;
    const detailRes = await fetchFootballApiV1(detailUrl, {
      headers: { Authorization: `Bearer ${apiToken}` },
      cache: "no-store",
    });
    if (!detailRes.ok) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = (await detailRes.json().catch(() => null)) as any;
    const chunk = collectProviderMatches(parsed);
    for (const m of chunk) {
      byId.set(m.matchId, m);
    }
  }
  return Array.from(byId.values());
}
