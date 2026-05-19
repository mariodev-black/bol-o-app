/**
 * Acesso de LEITURA ao Postgres `matches_cache`.
 *
 * Toda a escrita acontece em `lib/football/persistence.ts` (arquitetura v2).
 * Este arquivo contem apenas helpers de SELECT usados pelo restante da app
 * (palpites, partidas, ranking, premios).
 */

import { getPool } from "@/lib/db";
import {
  getAllSyncedCompetitionIds,
  getFootballMainCompetitionId,
} from "@/lib/boloes-extra-config";

export type CachedMatchRow = {
  competition_id: number;
  match_id: number;
  phase_key: string | null;
  group_key: string | null;
  round_key: string | null;
  status: string;
  kickoff_at: string | null;
  date_br: string;
  hour_br: string;
  result_casa: number | null;
  result_visitante: number | null;
  home_name: string;
  home_sigla: string;
  home_logo: string | null;
  away_name: string;
  away_sigla: string;
  away_logo: string | null;
  rodada: number | null;
  source_updated_at: string;
  synced_at: string;
};

function competitionId(): number {
  return getFootballMainCompetitionId();
}

export async function readMatchesCache(opts?: { competitionIds?: number[] }): Promise<CachedMatchRow[]> {
  const pool = getPool();
  const ids =
    opts?.competitionIds != null && opts.competitionIds.length > 0
      ? [...new Set(opts.competitionIds.filter((n) => Number.isFinite(n) && n > 0))]
      : getAllSyncedCompetitionIds();
  if (ids.length === 0) return [];
  const { rows } = await pool.query<CachedMatchRow>(
    `SELECT
      competition_id,
      match_id,
      phase_key,
      group_key,
      round_key,
      status,
      kickoff_at::text,
      date_br,
      hour_br,
      result_casa,
      result_visitante,
      home_name,
      home_sigla,
      home_logo,
      away_name,
      away_sigla,
      away_logo,
      rodada,
      source_updated_at::text,
      synced_at::text
     FROM matches_cache
     WHERE competition_id = ANY($1::int[])
     ORDER BY competition_id ASC, match_id ASC`,
    [ids],
  );
  return rows;
}

/** `match_id`s que existem na `matches_cache` (1 competicao). */
export async function getExistingMatchIdsFromCache(
  matchIds: number[],
  opts?: { competitionId?: number },
): Promise<Set<number>> {
  const uniq = [...new Set(matchIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (uniq.length === 0) return new Set();
  const pool = getPool();
  const comp = opts?.competitionId ?? competitionId();
  try {
    const { rows } = await pool.query<{ match_id: number }>(
      `SELECT match_id FROM matches_cache WHERE competition_id = $1 AND match_id = ANY($2::int[])`,
      [comp, uniq],
    );
    return new Set(rows.map((r) => Number(r.match_id)));
  } catch (e) {
    console.error("[matches-cache] getExistingMatchIdsFromCache", e);
    return new Set(uniq);
  }
}

/**
 * Remove palpites cujo `match_id` nao esta no calendario oficial do campeonato.
 * Se `matches_cache` estiver vazia (cron ainda nao populou), devolve tudo intacto.
 */
export async function filterPredictionsToOfficialMatchIds<T extends { match_id: number | string }>(
  predictions: T[],
  opts?: { competitionId?: number },
): Promise<T[]> {
  const ids = [
    ...new Set(predictions.map((p) => Number(p.match_id)).filter((n) => Number.isFinite(n) && n > 0)),
  ];
  if (ids.length === 0) return predictions;
  const pool = getPool();
  try {
    const comp = opts?.competitionId ?? competitionId();
    const { rows: cnt } = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM matches_cache WHERE competition_id = $1`,
      [comp],
    );
    if (Number(cnt[0]?.n ?? 0) === 0) return predictions;

    const existing = await getExistingMatchIdsFromCache(ids, { competitionId: comp });
    return predictions.filter((p) => existing.has(Number(p.match_id)));
  } catch (e) {
    console.error("[matches-cache] filterPredictionsToOfficialMatchIds", e);
    return predictions;
  }
}
