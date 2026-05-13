import { getPool } from "@/lib/db";
import { fetchFootballApiV1 } from "@/lib/football-api-fetch";
import { upsertFootballApiCache } from "@/lib/football-api-cache-store";

const CACHE_PREFIX = "competition_meta:";

/** TTL para revalidar nome na API (mantém leituras quentes no DB). */
const META_STALE_MS =
  Number.parseInt(process.env.COMPETITION_META_CACHE_TTL_MS ?? `${7 * 24 * 60 * 60 * 1000}`, 10) ||
  7 * 24 * 60 * 60 * 1000;

export function competitionMetadataCacheKey(competitionId: number): string {
  return `${CACHE_PREFIX}${competitionId}`;
}

export type CompetitionMetaPayload = {
  displayName: string;
  /** Resposta bruta (debug / futuro). */
  source?: unknown;
};

function token(): string {
  return (process.env.FOOTBALL_API_TOKEN || "").trim();
}

function pickDisplayNameFromJson(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const tryStr = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const nested = o.campeonato;
  if (nested && typeof nested === "object") {
    const n = nested as Record<string, unknown>;
    const fromNested =
      tryStr(n.nome) ?? tryStr(n.nome_popular) ?? tryStr(n.slug)?.replace(/-/g, " ") ?? null;
    if (fromNested) return fromNested;
  }
  return (
    tryStr(o.nome) ??
    tryStr(o.nome_popular) ??
    tryStr(o.name) ??
    (typeof o.slug === "string" ? o.slug.replace(/-/g, " ") : null)
  );
}

async function fetchCompetitionJsonFromApi(competitionId: number): Promise<unknown | null> {
  const apiToken = token();
  if (!apiToken) return null;
  const url = `https://api.api-futebol.com.br/v1/campeonatos/${competitionId}`;
  const res = await fetchFootballApiV1(url, {
    headers: { Authorization: `Bearer ${apiToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

/** Lê só do banco (rápido). */
export async function readCompetitionDisplayNamesFromDb(
  competitionIds: number[]
): Promise<Record<number, string>> {
  const uniq = [...new Set(competitionIds.filter((n) => Number.isFinite(n) && n > 0))];
  const out: Record<number, string> = {};
  if (uniq.length === 0) return out;
  const keys = uniq.map(competitionMetadataCacheKey);
  const pool = getPool();
  const { rows } = await pool.query<{ cache_key: string; payload: unknown }>(
    `SELECT cache_key, payload FROM football_api_cache WHERE cache_key = ANY($1::text[])`,
    [keys]
  );
  for (const row of rows) {
    const id = Number(String(row.cache_key).replace(CACHE_PREFIX, ""));
    if (!Number.isFinite(id)) continue;
    const payload = row.payload as CompetitionMetaPayload | null;
    const name = typeof payload?.displayName === "string" ? payload.displayName.trim() : "";
    if (name) out[id] = name;
  }
  return out;
}

function isStale(syncedAt: Date | null): boolean {
  if (!syncedAt) return true;
  return Date.now() - syncedAt.getTime() > META_STALE_MS;
}

/**
 * Garante nomes em cache: usa `football_api_cache`; só chama a API para ids sem entrada ou velhos.
 * Idempotente; uso após sync de partidas ou na primeira abertura do checkout / bolões.
 */
export async function warmCompetitionMetadataCache(competitionIds: number[]): Promise<Record<number, string>> {
  const uniq = [...new Set(competitionIds.filter((n) => Number.isFinite(n) && n > 0))];
  if (uniq.length === 0) return {};

  const pool = getPool();
  const out: Record<number, string> = {};

  for (const id of uniq) {
    const key = competitionMetadataCacheKey(id);
    const { rows } = await pool.query<{ payload: unknown; synced_at: Date | null }>(
      `SELECT payload, synced_at FROM football_api_cache WHERE cache_key = $1 LIMIT 1`,
      [key]
    );
    const row = rows[0];
    const payload = row?.payload as CompetitionMetaPayload | null;
    const cachedName = typeof payload?.displayName === "string" ? payload.displayName.trim() : "";
    const freshEnough = cachedName.length > 0 && !isStale(row?.synced_at ?? null);

    if (freshEnough) {
      out[id] = cachedName;
      continue;
    }

    const json = await fetchCompetitionJsonFromApi(id);
    const picked = pickDisplayNameFromJson(json);
    const displayName = picked && picked.length > 0 ? picked : `Campeonato ${id}`;
    const nextPayload: CompetitionMetaPayload = { displayName, source: json ?? undefined };
    await upsertFootballApiCache(key, id, nextPayload);
    out[id] = displayName;
  }

  return out;
}
