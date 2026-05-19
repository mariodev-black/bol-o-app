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

// ---------------------------------------------------------------------
// Tipo do resultado
// ---------------------------------------------------------------------

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

  const snapshot = await fetchChampionshipSnapshot(competitionId);
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

// ---------------------------------------------------------------------
// Tudo: principal + extras
// ---------------------------------------------------------------------

export async function syncAllConfigured(): Promise<{
  principal: SyncCompetitionResult | null;
  extras: SyncCompetitionResult[];
  totalMs: number;
  /** Outro processo já estava rodando o mesmo full sync (lock Postgres). */
  skippedConcurrent?: boolean;
}> {
  const done = await tryWithFootballAdvisoryLock(ADVISORY_LOCK_FOOTBALL_FULL_SYNC, async () => {
    const t0 = Date.now();

    let principal: SyncCompetitionResult | null = null;
    try {
      principal = await syncPrincipal();
    } catch (err) {
      console.error("[syncAllConfigured] principal falhou:", err);
    }

    const extras: SyncCompetitionResult[] = [];
    for (const id of parseExtraBolaoChampionshipIds()) {
      try {
        extras.push(await syncExtra(id));
      } catch (err) {
        console.error(`[syncAllConfigured] extra ${id} falhou:`, err);
      }
    }

    return { principal, extras, totalMs: Date.now() - t0 };
  });

  if (done == null) {
    console.info("[syncAllConfigured] skip — outra sessão segura o advisory lock (full sync)");
    return { principal: null, extras: [], totalMs: 0, skippedConcurrent: true };
  }
  return done;
}

/**
 * Inicializacao: se nao temos NADA da competicao no Postgres, baixa de imediato.
 * Caso ja exista pelo menos 1 linha, NAO chama API (espera o cron diario / worker).
 */
export async function syncAllConfiguredIfStale(opts?: {
  forceIfOlderThanHours?: number;
}): Promise<{ ran: boolean; reason: string; result?: Awaited<ReturnType<typeof syncAllConfigured>> }> {
  const pool = getPool();
  const ids = getAllSyncedCompetitionIds();
  if (ids.length === 0) return { ran: false, reason: "sem-campeonatos-configurados" };

  const { rows } = await pool.query<{ competition_id: number; max_sync: string | null; total: string }>(
    `SELECT competition_id, max(synced_at)::text AS max_sync, count(*)::text AS total
     FROM matches_cache
     WHERE competition_id = ANY($1::int[])
     GROUP BY competition_id`,
    [ids],
  );

  const totalsByComp = new Map(rows.map((r) => [Number(r.competition_id), Number(r.total)]));
  const missing = ids.filter((id) => (totalsByComp.get(id) ?? 0) === 0);
  if (missing.length > 0) {
    const result = await syncAllConfigured();
    if (result.skippedConcurrent) {
      const { rows: rowsPeer } = await pool.query<{ competition_id: number; total: string }>(
        `SELECT competition_id, count(*)::text AS total
         FROM matches_cache
         WHERE competition_id = ANY($1::int[])
         GROUP BY competition_id`,
        [ids],
      );
      const after = new Map(rowsPeer.map((r) => [Number(r.competition_id), Number(r.total)]));
      const stillMissing = ids.filter((id) => (after.get(id) ?? 0) === 0);
      if (stillMissing.length === 0) {
        return { ran: false, reason: "cache-populado-por-peer", result };
      }
    }
    return { ran: true, reason: `cache-vazio:${missing.join(",")}`, result };
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
      const result = await syncAllConfigured();
      return { ran: true, reason: `mais-velho-que-${horas}h`, result };
    }
  }

  return { ran: false, reason: "cache-presente" };
}
