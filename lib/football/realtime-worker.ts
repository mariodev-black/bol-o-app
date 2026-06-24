/**
 * Arquitetura v2 — Worker em tempo real (1 min).
 *
 *   1) Le matches_cache e seleciona partidas que DEVERIAM estar ao vivo:
 *        - status ja indica ao vivo / em andamento / intervalo / pausado, OU
 *        - kickoff_at >= now() - 5 min  E  kickoff_at <= now() + 5 min (apito iminente),
 *        - OU kickoff_at <= now()  E  now() <= kickoff_at + WORKER_WINDOW_MINUTES (default 180min).
 *      EXCLUI rigorosamente:
 *        - finalizado / encerrado (exceto "resgate" — ver abaixo)
 *        - cancelado / adiado / suspenso / interrompido
 *
 *      RESGATE (stale finalizado): partida marcada encerrada no cache mas ainda
 *      dentro da janela pós-apito, com provider_payload ou placar 0×0 suspeito.
 *      Cobre admin que grava placar sem atualizar status/payload.
 *
 *   2) Para cada partida selecionada, chama GET /partidas/:id (UNICA chamada por partida por tick).
 *
 *   3) Persiste em batch via persistMatchesV2 — que ja roda a cascata
 *      (invalidar match_map, revalidar leaderboard, fechar premios elegiveis).
 *
 * Importante:
 *   - rate-limit: cap de WORKER_MAX_PER_TICK (default 20) partidas por tick.
 *   - paralelismo: requests sequenciais (API Futebol nao gosta de rajadas).
 *   - quem nao esta na janela e ja tem status finalizado nunca mais e consultada.
 */

import { getPool } from "@/lib/db";
import { getFootballApiSyncExcludedCompetitionIds } from "@/lib/football/amistosos-friendlies-config";
import {
  ADVISORY_LOCK_FOOTBALL_REALTIME_TICK,
  tryWithFootballAdvisoryLock,
} from "@/lib/football/advisory-locks";
import { fetchMatchDetailById, type ProviderMatchV2 } from "@/lib/football/provider";
import { persistMatchesV2 } from "@/lib/football/persistence";

function intEnv(name: string, fallback: number, min = 1, max = 1_000_000): number {
  const raw = Number.parseInt((process.env[name] || "").trim(), 10);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, raw));
}

/** Tamanho da janela depois do apito que mantemos consultando — default 180 min. */
function workerWindowMinutes(): number {
  return intEnv("REALTIME_WORKER_WINDOW_MINUTES", 180, 30, 360);
}

/** Margem antes do apito (proximas partidas) — default 5 min. */
function workerPreKickoffMinutes(): number {
  return intEnv("REALTIME_WORKER_PRE_KICKOFF_MINUTES", 5, 0, 60);
}

/** Cap de partidas consultadas por tick. */
function workerMaxPerTick(): number {
  return intEnv("REALTIME_WORKER_MAX_PER_TICK", 20, 1, 200);
}

const SELECT_ACTIVE_MATCHES_SQL = `
SELECT competition_id, match_id, status, kickoff_at::text AS kickoff_at
FROM matches_cache mc
WHERE
  lower(coalesce(status, '')) NOT LIKE '%cancel%'
  AND lower(coalesce(status, '')) NOT LIKE '%adiad%'
  AND lower(coalesce(status, '')) NOT LIKE '%suspens%'
  AND lower(coalesce(status, '')) NOT LIKE '%interromp%'
  AND NOT (mc.competition_id = ANY($4::int[]))
  AND (
    -- fluxo normal: nao encerrada + ao vivo ou na janela do apito
    (
      lower(coalesce(status, '')) NOT LIKE '%finaliz%'
      AND lower(coalesce(status, '')) NOT LIKE '%encerr%'
      AND (
        lower(coalesce(status, '')) LIKE '%andamento%'
        OR lower(coalesce(status, '')) LIKE '%ao vivo%'
        OR lower(coalesce(status, '')) LIKE '%intervalo%'
        OR lower(coalesce(status, '')) LIKE '%pausad%'
        OR lower(coalesce(status, '')) LIKE '%em curso%'
        OR (
          kickoff_at IS NOT NULL
          AND kickoff_at <= now() + ($1::text || ' minutes')::interval
          AND kickoff_at >= now() - ($2::text || ' minutes')::interval
        )
      )
    )
    OR (
      -- resgate: cache diz finalizado mas ainda na janela — reconsulta a API
      kickoff_at IS NOT NULL
      AND kickoff_at <= now()
      AND kickoff_at >= now() - ($2::text || ' minutes')::interval
      AND (
        lower(coalesce(status, '')) LIKE '%finaliz%'
        OR lower(coalesce(status, '')) LIKE '%encerr%'
      )
      AND (
        lower(coalesce(mc.provider_payload->>'status', '')) LIKE '%andamento%'
        OR lower(coalesce(mc.provider_payload->>'status', '')) LIKE '%intervalo%'
        OR lower(coalesce(mc.provider_payload->>'status', '')) LIKE '%vivo%'
        OR lower(coalesce(mc.provider_payload->>'status', '')) LIKE '%em curso%'
        OR (
          coalesce(result_casa, 0) = 0
          AND coalesce(result_visitante, 0) = 0
          AND lower(coalesce(mc.provider_payload->>'status', '')) NOT LIKE '%finaliz%'
          AND lower(coalesce(mc.provider_payload->>'status', '')) NOT LIKE '%encerr%'
        )
      )
    )
  )
ORDER BY kickoff_at ASC NULLS LAST
LIMIT $3
`;

type ActiveRow = {
  competition_id: number;
  match_id: number;
  status: string | null;
  kickoff_at: string | null;
};

export type RealtimeTickResult = {
  selected: number;
  fetched: number;
  /** UPSERTs realizados em matches_cache (novas + scoredChanged). */
  persisted: number;
  /** Subset de `changedMatchIds` cuja PONTUAÇÃO realmente mudou. */
  scoredChangedIds: number[];
  /** Partidas selecionadas mas idênticas ao cache (sem write). */
  unchanged: number;
  /** Linhas em prediction_scores recalculadas (somente para scoredChangedIds). */
  predictionScoresUpdated: number;
  changedMatchIds: number[];
  ms: number;
  skipped?: string;
};

/**
 * Executa UM tick do worker. Serializado no cluster via `pg_try_advisory_lock`
 * (ver `lib/football/advisory-locks.ts`) para não duplicar GET /partidas entre
 * PM2 workers, réplicas ou scheduler + cron HTTP.
 */
export async function runRealtimeTick(): Promise<RealtimeTickResult> {
  const t0 = Date.now();
  const out = await tryWithFootballAdvisoryLock(ADVISORY_LOCK_FOOTBALL_REALTIME_TICK, () =>
    runRealtimeTickUnlocked(),
  );
  if (out == null) {
    return {
      selected: 0,
      fetched: 0,
      persisted: 0,
      scoredChangedIds: [],
      unchanged: 0,
      predictionScoresUpdated: 0,
      changedMatchIds: [],
      ms: Date.now() - t0,
      skipped: "advisory-lock-busy",
    };
  }
  return out;
}

async function runRealtimeTickUnlocked(): Promise<RealtimeTickResult> {
  const t0 = Date.now();
  const pool = getPool();

  const windowMin = workerWindowMinutes();
  const preMin = workerPreKickoffMinutes();
  const cap = workerMaxPerTick();

  const excludedCompetitions = getFootballApiSyncExcludedCompetitionIds();
  const { rows } = await pool.query<ActiveRow>(SELECT_ACTIVE_MATCHES_SQL, [
    String(preMin),
    String(windowMin),
    cap,
    excludedCompetitions,
  ]);

  if (rows.length === 0) {
    return {
      selected: 0,
      fetched: 0,
      persisted: 0,
      scoredChangedIds: [],
      unchanged: 0,
      predictionScoresUpdated: 0,
      changedMatchIds: [],
      ms: Date.now() - t0,
      skipped: "no-active-matches",
    };
  }

  const updates: ProviderMatchV2[] = [];
  for (const r of rows) {
    try {
      const detail = await fetchMatchDetailById(r.match_id);
      if (!detail) continue;
      // mantem competitionId do cache caso o detalhe nao traga (raros casos da API).
      const competitionId = detail.competitionId || r.competition_id;
      updates.push({ ...detail, competitionId });
    } catch (err) {
      console.warn(`[realtime-worker] partida ${r.match_id} falhou:`, err);
    }
  }

  if (updates.length === 0) {
    return {
      selected: rows.length,
      fetched: 0,
      persisted: 0,
      scoredChangedIds: [],
      unchanged: 0,
      predictionScoresUpdated: 0,
      changedMatchIds: [],
      ms: Date.now() - t0,
    };
  }

  const persisted = await persistMatchesV2(updates, {
    cascadeSource: "realtime-worker",
    runCascadingClosures: true,
  });

  const copaId = Number(process.env.FOOTBALL_COMPETITION_ID || "72") || 72;
  if (updates.some((m) => Number(m.competitionId) === copaId)) {
    try {
      const { mirrorSkaleBolaoMatchesFromCopa } = await import(
        "@/lib/football/skale-bolao-sync"
      );
      await mirrorSkaleBolaoMatchesFromCopa();
    } catch (err) {
      console.warn("[realtime-worker] mirror Skale bolão:", err);
    }
  }

  return {
    selected: rows.length,
    fetched: updates.length,
    persisted: persisted.written,
    scoredChangedIds: persisted.scoredChangedIds,
    unchanged: persisted.unchanged,
    predictionScoresUpdated: persisted.predictionScoresUpdated,
    changedMatchIds: persisted.changedMatchIds,
    ms: Date.now() - t0,
  };
}
