import { NextRequest, NextResponse } from "next/server";
import {
  readFootballApiCacheJson,
  standingsCacheKey,
  upsertFootballApiCache,
} from "@/lib/football-api-cache-store";
import { getAllSyncedCompetitionIds } from "@/lib/boloes-extra-config";
import { isFootballApiSyncExcludedCompetitionId } from "@/lib/football/amistosos-friendlies-config";
import { downloadStandingsJson } from "@/lib/football-external-downloads";

export const runtime = "nodejs";

function defaultCompetitionId(): number {
  return Number.parseInt((process.env.FOOTBALL_COMPETITION_ID || "72").trim(), 10) || 72;
}

function footballApiToken(): string {
  return (process.env.FOOTBALL_API_TOKEN || "").trim();
}

/** Só preenche cache sob demanda para campeonatos que o app já sincroniza (principal + BOLOES_EXTRA_*). */
function isAllowedStandingsCompetition(compNum: number): boolean {
  if (isFootballApiSyncExcludedCompetitionId(compNum)) return false;
  return getAllSyncedCompetitionIds().includes(compNum);
}

/**
 * Lê `football_api_cache` (chave `standings:{id}`).
 * Se vazio e `FOOTBALL_API_TOKEN` existir, tenta **um** GET na API-Futebol, grava no Postgres e devolve o JSON (auto-heal).
 * `?competitionId=` opcional (default = FOOTBALL_COMPETITION_ID).
 * `?debug=1` acrescenta campos extras em erros.
 */
export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get("competitionId");
    const compNum =
      raw != null && String(raw).trim() !== "" && Number.isFinite(Number(raw))
        ? Number(raw)
        : defaultCompetitionId();
    const key = standingsCacheKey(compNum);
    const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    const debug = request.nextUrl.searchParams.get("debug") === "1";

    let payload = await readFootballApiCacheJson(key).catch(() => null);
    if (payload != null) {
      return NextResponse.json(payload, {
        headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=3600" },
      });
    }

    const token = footballApiToken();
    if (token && isAllowedStandingsCompetition(compNum)) {
      try {
        const standings = await downloadStandingsJson(String(compNum), token);
        await upsertFootballApiCache(key, compNum, standings);
        payload = await readFootballApiCacheJson(key).catch(() => null);
        if (payload != null) {
          if (debug) {
            console.info("[api/tabela] filled from api", { competitionId: compNum, cacheKey: key });
          }
          return NextResponse.json(payload, {
            headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
          });
        }
      } catch (e) {
        console.error("[api/tabela] on-demand standings failed", {
          competitionId: compNum,
          cacheKey: key,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const base: Record<string, unknown> = {
      error:
        token && !isAllowedStandingsCompetition(compNum)
          ? `Campeonato ${compNum} nao esta em FOOTBALL_COMPETITION_ID nem em BOLOES_EXTRA_CHAMPIONSHIP_IDS; cache nao preenchido por seguranca.`
          : !token
            ? "Nenhuma tabela em cache e FOOTBALL_API_TOKEN nao configurado — nao e possivel buscar na API."
            : `Nenhuma tabela em cache (chave "${key}") e a busca na API-Futebol falhou ou nao retornou dados.`,
      competitionId: compNum,
      cacheKey: key,
      requestPath,
      upstreamShape:
        "Cache: football_api_cache.cache_key = standings:{id}. Opcional: GET https://api.api-futebol.com.br/v1/campeonatos/{id}/tabela (preenchimento automatico nesta rota quando ha token e id permitido).",
    };

    if (debug) {
      base.syncedCompetitionIdsFromEnv = getAllSyncedCompetitionIds();
      base.hasFootballApiToken = Boolean(token);
      base.allowedForOnDemandFill = isAllowedStandingsCompetition(compNum);
      console.warn("[api/tabela] cache miss (debug=1)", base);
      return NextResponse.json(base, { status: 503 });
    }

    console.warn("[api/tabela] cache miss", { competitionId: compNum, cacheKey: key, requestPath });

    return NextResponse.json(base, { status: 503 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao buscar tabela";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
