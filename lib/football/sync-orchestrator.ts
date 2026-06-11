/**
 * Arquitetura v2 — Orquestrador de sync (campeonatos + partidas).
 *
 *   syncPrincipal(competitionId)   -> /campeonatos/:id + /campeonatos/:id/partidas
 *   syncExtra(competitionId)       -> /campeonatos/:id (rodada_atual) + /rodadas/:rodada
 *   syncAllConfigured()            -> principal + todos os extras (serializado no
 *                                     cluster via advisory lock — ver advisory-locks.ts)
 *
 * Esse modulo NAO decide cadencia. Quem decide cadencia:
 *   - cron diario 00:01 BRT       -> chama syncAllConfigured() uma vez por dia.
 *   - worker 1 min                -> chama runRealtimeTick() so para jogos abertos.
 *   - inicializacao (bootstrap)   -> chama syncAllConfiguredIfStale() se cache vazio.
 */

import {
  getAllSyncedCompetitionIds,
  getFootballMainCompetitionId,
  parseExtraBolaoChampionshipIds,
} from "@/lib/boloes-extra-config";
import {
  isFootballApiSyncExcludedCompetitionId,
  getFootballApiSyncableCompetitionIds,
} from "@/lib/football/amistosos-friendlies-config";
import { isAmistososFriendliesCompetition } from "@/lib/football/amistosos-friendlies";
import { ensureAmistososFriendliesMatchesSeeded } from "@/lib/football/amistosos-friendlies-persistence";
import { isSkaleBolaoCompetition } from "@/lib/boloes/skale-config";
import {
  fetchChampionshipSnapshot,
  fetchPrincipalMatches,
  fetchRodadaMatches,
  type ChampionshipSnapshotV2,
} from "@/lib/football/provider";
import {
  persistChampionshipSnapshot,
  persistMatchesV2,
} from "@/lib/football/persistence";
import {
  ADVISORY_LOCK_FOOTBALL_FULL_SYNC,
  tryWithFootballAdvisoryLock,
} from "@/lib/football/advisory-locks";
import { getPool } from "@/lib/db";

declare global {
  var __bolaoLastFullSyncMs: number | undefined;
}

function intEnv(name: string, fallback: number): number {
  const n = Number.parseInt((process.env[name] || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function fullSyncMinIntervalMs(): number {
  return intEnv("FOOTBALL_FULL_SYNC_MIN_INTERVAL_MS", 1_800_000);
}

function extraSyncMinIntervalMs(): number {
  return intEnv("FOOTBALL_EXTRA_SYNC_MIN_INTERVAL_MS", 14_400_000);
}

function isHttp401Error(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b401\b/.test(msg);
}


export type SyncCompetitionResult = {
  competitionId: number;
  mode: "principal" | "extra";
  championship: ChampionshipSnapshotV2 | null;
  matchesPersisted: number;
  rodadasCarregadas: number[];
  skippedReason?: string;
  ms: number;
};

// ---------------------------------------------------------------------
// Principal: snapshot + /partidas (hierarquico)
// ---------------------------------------------------------------------

export async function syncPrincipal(): Promise<SyncCompetitionResult> {
  const t0 = Date.now();
  const competitionId = getFootballMainCompetitionId();

  // 1) snapshot do campeonato (nome/slug/temporada/rodada_atual/status)
  const snapshot = await fetchChampionshipSnapshot(competitionId).catch(() => null);
  if (snapshot) {
    await persistChampionshipSnapshot(snapshot).catch((err) =>
      console.warn("[syncPrincipal] persistChampionshipSnapshot:", err),
    );
  }

  // 2) /campeonatos/:id/partidas — payload hierarquico
  const matches = await fetchPrincipalMatches(
    competitionId,
    snapshot
      ? { nome: snapshot.nome, slug: snapshot.slug, temporada: snapshot.temporada }
      : undefined,
  );

  await persistMatchesV2(matches, {
    cascadeSource: "sync-principal",
    runCascadingClosures: true,
  });

  try {
    const { mirrorSkaleBolaoMatchesFromCopa } = await import(
      "@/lib/football/skale-bolao-sync"
    );
    await mirrorSkaleBolaoMatchesFromCopa();
  } catch (err) {
    console.warn("[syncPrincipal] mirror Skale bolão:", err);
  }

  return {
    competitionId,
    mode: "principal",
    championship: snapshot,
    matchesPersisted: matches.length,
    rodadasCarregadas: [],
    ms: Date.now() - t0,
  };
}

// ---------------------------------------------------------------------
// Extra: snapshot + rodada_atual + (opcionalmente rodadas adicionais)
// ---------------------------------------------------------------------

/**
 * Bolão extra POR RODADA — carrega a rodada_atual e, opcionalmente, rodadas
 * adicionais (ex.: a anterior, para histórico, e a próxima, para abrir palpites
 * com antecedência).
 */
export async function syncExtra(
  competitionId: number,
  opts?: { extraRodadas?: number[] },
): Promise<SyncCompetitionResult> {
  const t0 = Date.now();

  if (isFootballApiSyncExcludedCompetitionId(competitionId)) {
    return {
      competitionId,
      mode: "extra",
      championship: null,
      matchesPersisted: 0,
      rodadasCarregadas: [],
      skippedReason: "excluded",
      ms: Date.now() - t0,
    };
  }

  let snapshot: ChampionshipSnapshotV2;
  try {
    snapshot = await fetchChampionshipSnapshot(competitionId);
  } catch (err) {
    if (isHttp401Error(err)) {
      console.warn(
        `[syncExtra:${competitionId}] skip — campeonato fora do plano API (401)`,
      );
      return {
        competitionId,
        mode: "extra",
        championship: null,
        matchesPersisted: 0,
        rodadasCarregadas: [],
        skippedReason: "api-401",
        ms: Date.now() - t0,
      };
    }
    throw err;
  }

  await persistChampionshipSnapshot(snapshot).catch((err) =>
    console.warn(`[syncExtra:${competitionId}] persistChampionshipSnapshot:`, err),
  );

  const rodadaAtual = snapshot.rodadaAtual?.numero ?? null;
  if (!rodadaAtual) {
    return {
      competitionId,
      mode: "extra",
      championship: snapshot,
      matchesPersisted: 0,
      rodadasCarregadas: [],
      skippedReason: "snapshot-sem-rodada-atual",
      ms: Date.now() - t0,
    };
  }

  const toLoad = new Set<number>([rodadaAtual]);
  const rodadaStatus = (snapshot.rodadaAtual?.status ?? "").toLowerCase();
  if (
    rodadaStatus.includes("encerr") ||
    rodadaStatus.includes("finaliz") ||
    rodadaStatus === "final"
  ) {
    const next = rodadaAtual + 1;
    const total = snapshot.totalRodadas;
    if (!total || next <= total) toLoad.add(next);
  }
  for (const extra of opts?.extraRodadas ?? []) {
    if (Number.isFinite(extra) && extra > 0) toLoad.add(extra);
  }

  const meta = {
    nome: snapshot.nome,
    slug: snapshot.slug,
    temporada: snapshot.temporada,
  };

  let total = 0;
  const carregadas: number[] = [];
  for (const rodada of toLoad) {
    try {
      const partidas = await fetchRodadaMatches(competitionId, rodada, meta);
      if (partidas.length > 0) {
        await persistMatchesV2(partidas, {
          cascadeSource: `sync-extra:${competitionId}:r${rodada}`,
          runCascadingClosures: true,
        });
        total += partidas.length;
      }
      carregadas.push(rodada);
    } catch (err) {
      console.warn(`[syncExtra:${competitionId}] rodada ${rodada} falhou:`, err);
    }
  }

  return {
    competitionId,
    mode: "extra",
    championship: snapshot,
    matchesPersisted: total,
    rodadasCarregadas: carregadas,
    ms: Date.now() - t0,
  };
}

/**
 * Sync extra só quando necessário — evita bater na API a cada page load.
 * Com `onlyIfEmpty: true` (palpites SSR), só bootstrap se cache vazio.
 */
export async function syncExtraIfStale(
  competitionId: number,
  opts?: {
    extraRodadas?: number[];
    minIntervalMs?: number;
    onlyIfEmpty?: boolean;
  },
): Promise<{ ran: boolean; reason: string; result?: SyncCompetitionResult }> {
  if (isFootballApiSyncExcludedCompetitionId(competitionId)) {
    return { ran: false, reason: "excluded" };
  }

  const pool = getPool();
  const { rows } = await pool.query<{ n: number; max_sync: string | null }>(
    `SELECT count(*)::int AS n, max(synced_at)::text AS max_sync
     FROM matches_cache
     WHERE competition_id = $1`,
    [competitionId],
  );
  const total = Number(rows[0]?.n ?? 0);

  if (total === 0) {
    try {
      const result = await syncExtra(competitionId, opts);
      return { ran: true, reason: "cache-vazio", result };
    } catch (err) {
      console.warn(`[syncExtraIfStale:${competitionId}] bootstrap falhou:`, err);
      return { ran: false, reason: "erro-bootstrap" };
    }
  }

  if (opts?.onlyIfEmpty) {
    return { ran: false, reason: "cache-presente" };
  }

  const minMs = opts?.minIntervalMs ?? extraSyncMinIntervalMs();
  const maxSync = rows[0]?.max_sync ? Date.parse(rows[0].max_sync) : NaN;
  if (Number.isFinite(maxSync) && Date.now() - maxSync < minMs) {
    return { ran: false, reason: "cache-recente" };
  }

  try {
    const result = await syncExtra(competitionId, opts);
    return { ran: true, reason: "stale", result };
  } catch (err) {
    console.warn(`[syncExtraIfStale:${competitionId}] refresh falhou:`, err);
    return { ran: false, reason: "erro-refresh" };
  }
}

// ---------------------------------------------------------------------
// Tudo: principal + extras
// ---------------------------------------------------------------------

export async function syncAllConfigured(opts?: {
  /** Ignora throttle de intervalo mínimo (bootstrap com cache vazio). */
  force?: boolean;
}): Promise<{
  principal: SyncCompetitionResult | null;
  extras: SyncCompetitionResult[];
  totalMs: number;
  /** Outro processo já estava rodando o mesmo full sync (lock Postgres). */
  skippedConcurrent?: boolean;
  /** Throttle in-process — full sync rodou há pouco. */
  skippedThrottled?: boolean;
}> {
  const done = await tryWithFootballAdvisoryLock(ADVISORY_LOCK_FOOTBALL_FULL_SYNC, async () => {
    if (!opts?.force) {
      const last = globalThis.__bolaoLastFullSyncMs ?? 0;
      if (Date.now() - last < fullSyncMinIntervalMs()) {
        console.info(
          `[syncAllConfigured] skip — throttle (${fullSyncMinIntervalMs()}ms)`,
        );
        return {
          principal: null,
          extras: [],
          totalMs: 0,
          skippedThrottled: true,
        };
      }
    }

    const t0 = Date.now();

    let principal: SyncCompetitionResult | null = null;
    try {
      principal = await syncPrincipal();
    } catch (err) {
      console.error("[syncAllConfigured] principal falhou:", err);
    }

    const extras: SyncCompetitionResult[] = [];

    for (const id of parseExtraBolaoChampionshipIds()) {
      if (isFootballApiSyncExcludedCompetitionId(id)) continue;
      try {
        extras.push(await syncExtra(id));
      } catch (err) {
        console.error(`[syncAllConfigured] extra ${id} falhou:`, err);
      }
    }

    globalThis.__bolaoLastFullSyncMs = Date.now();
    return { principal, extras, totalMs: Date.now() - t0 };
  });

  if (done == null) {
    console.info("[syncAllConfigured] skip — outra sessão segura o advisory lock (full sync)");
    return { principal: null, extras: [], totalMs: 0, skippedConcurrent: true };
  }
  if (done.skippedThrottled) {
    return { principal: null, extras: [], totalMs: 0, skippedThrottled: true };
  }
  return done;
}

async function countMatchesForCompetition(competitionId: number): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM matches_cache WHERE competition_id = $1`,
    [competitionId],
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Popula cache de UMA competição quando vazio — sem sync global de todos os bolões.
 * Amistosos (seed local) e Skale (espelho da Copa) não usam API-Futebol.
 */
export async function bootstrapCompetitionCacheIfEmpty(
  competitionId: number,
): Promise<{ ran: boolean; reason: string }> {
  const existing = await countMatchesForCompetition(competitionId);
  if (existing > 0) {
    return { ran: false, reason: "cache-presente" };
  }

  if (isAmistososFriendliesCompetition(competitionId)) {
    await ensureAmistososFriendliesMatchesSeeded().catch((err) => {
      console.warn("[bootstrapCompetitionCache] amistosos seed:", err);
    });
    return { ran: true, reason: "amistosos-seed" };
  }

  if (isSkaleBolaoCompetition(competitionId)) {
    const mainId = getFootballMainCompetitionId();
    const mainCount = await countMatchesForCompetition(mainId);
    if (mainCount === 0) {
      await syncPrincipal().catch((err) => {
        console.warn("[bootstrapCompetitionCache] copa antes do espelho Skale:", err);
      });
    }
    const { mirrorSkaleBolaoMatchesFromCopa } = await import(
      "@/lib/football/skale-bolao-sync"
    );
    await mirrorSkaleBolaoMatchesFromCopa().catch((err) => {
      console.warn("[bootstrapCompetitionCache] espelho Skale:", err);
    });
    return { ran: true, reason: "skale-mirror" };
  }

  if (isFootballApiSyncExcludedCompetitionId(competitionId)) {
    return { ran: false, reason: "excluded" };
  }

  const mainId = getFootballMainCompetitionId();
  if (competitionId === mainId) {
    await syncPrincipal();
    return { ran: true, reason: "sync-principal" };
  }

  await syncExtra(competitionId);
  return { ran: true, reason: "sync-extra" };
}

/**
 * Inicializacao: se nao temos NADA da competicao no Postgres, baixa de imediato.
 * Caso ja exista pelo menos 1 linha, NAO chama API (espera o cron diario / worker).
 */
export async function syncAllConfiguredIfStale(opts?: {
  forceIfOlderThanHours?: number;
  /** Só verifica/bootstrap esta competição (ex.: page load de palpites). */
  competitionId?: number;
}): Promise<{ ran: boolean; reason: string; result?: Awaited<ReturnType<typeof syncAllConfigured>> }> {
  if (opts?.competitionId != null && Number.isFinite(opts.competitionId)) {
    const boot = await bootstrapCompetitionCacheIfEmpty(opts.competitionId);
    return { ran: boot.ran, reason: boot.reason };
  }

  const pool = getPool();
  const allIds = getAllSyncedCompetitionIds();
  const apiIds = getFootballApiSyncableCompetitionIds();
  if (allIds.length === 0) return { ran: false, reason: "sem-campeonatos-configurados" };

  for (const id of allIds) {
    if (isFootballApiSyncExcludedCompetitionId(id)) {
      const n = await countMatchesForCompetition(id);
      if (n === 0) {
        await bootstrapCompetitionCacheIfEmpty(id);
      }
    }
  }

  if (apiIds.length === 0) {
    return { ran: false, reason: "sem-campeonatos-api" };
  }

  const { rows } = await pool.query<{ competition_id: number; max_sync: string | null; total: string }>(
    `SELECT competition_id, max(synced_at)::text AS max_sync, count(*)::text AS total
     FROM matches_cache
     WHERE competition_id = ANY($1::int[])
     GROUP BY competition_id`,
    [apiIds],
  );

  const totalsByComp = new Map(rows.map((r) => [Number(r.competition_id), Number(r.total)]));
  const missing = apiIds.filter((id) => (totalsByComp.get(id) ?? 0) === 0);
  if (missing.length > 0) {
    let anyRan = false;
    for (const id of missing) {
      try {
        const boot = await bootstrapCompetitionCacheIfEmpty(id);
        if (boot.ran) anyRan = true;
      } catch (err) {
        console.error(`[syncAllConfiguredIfStale] bootstrap ${id} falhou:`, err);
      }
    }
    return {
      ran: anyRan,
      reason: anyRan ? `cache-vazio:${missing.join(",")}` : "bootstrap-falhou",
    };
  }

  const horas = opts?.forceIfOlderThanHours ?? 0;
  if (horas > 0) {
    const limit = Date.now() - horas * 3_600_000;
    const stale = rows.some((r) => {
      if (!r.max_sync) return true;
      const t = Date.parse(r.max_sync);
      return Number.isFinite(t) && t < limit;
    });
    if (stale) {
      const result = await syncAllConfigured({ force: true });
      return { ran: true, reason: `mais-velho-que-${horas}h`, result };
    }
  }

  return { ran: false, reason: "cache-presente" };
}
