import { getPool } from "@/lib/db";
import { invalidateMatchMapMemoryAfterDbWrite } from "@/lib/match-map-cache-invalidator";
import {
  AMISTOSOS_FRIENDLY_MATCHES,
  amistososMatchToCacheRow,
  getAmistososFriendliesCompetitionId,
} from "@/lib/football/amistosos-friendlies";

export type AmistososAdminMatchRow = {
  matchId: number;
  dateBr: string;
  hourBr: string;
  homeName: string;
  awayName: string;
  homeSigla: string;
  awaySigla: string;
  homeLogo: string | null;
  awayLogo: string | null;
  status: string;
  resultCasa: number | null;
  resultVisitante: number | null;
};

/** Garante partidas do bolão amistosos em `matches_cache` (idempotente). */
export async function ensureAmistososFriendliesMatchesSeeded(): Promise<number> {
  const pool = getPool();
  const competitionId = getAmistososFriendliesCompetitionId();
  let upserted = 0;

  for (const def of AMISTOSOS_FRIENDLY_MATCHES) {
    const row = amistososMatchToCacheRow(def);
    const kickoffIso = `2026-06-06T${row.hourBr}:00-03:00`;

    await pool.query(
      `INSERT INTO matches_cache (
         competition_id, match_id,
         phase_key, group_key, round_key,
         status, kickoff_at,
         date_br, hour_br,
         result_casa, result_visitante,
         home_name, home_sigla, home_logo,
         away_name, away_sigla, away_logo,
         rodada, championship_name,
         source_updated_at, synced_at
       ) VALUES (
         $1, $2,
         'amistosos', 'dia6', 'amistosos-dia6',
         $3, $4::timestamptz,
         $5, $6,
         NULL, NULL,
         $7, $8, $9,
         $10, $11, $12,
         $13, $14,
         now(), now()
       )
       ON CONFLICT (competition_id, match_id) DO UPDATE SET
         date_br = EXCLUDED.date_br,
         hour_br = EXCLUDED.hour_br,
         home_name = EXCLUDED.home_name,
         home_sigla = EXCLUDED.home_sigla,
         home_logo = COALESCE(EXCLUDED.home_logo, matches_cache.home_logo),
         away_name = EXCLUDED.away_name,
         away_sigla = EXCLUDED.away_sigla,
         away_logo = COALESCE(EXCLUDED.away_logo, matches_cache.away_logo),
         rodada = EXCLUDED.rodada,
         championship_name = EXCLUDED.championship_name,
         synced_at = now()`,
      [
        competitionId,
        row.matchId,
        row.status,
        kickoffIso,
        row.dateBr,
        row.hourBr,
        row.homeName,
        row.homeSigla,
        row.homeLogo,
        row.awayName,
        row.awaySigla,
        row.awayLogo,
        row.rodada,
        row.championshipName,
      ],
    );
    upserted += 1;
  }

  invalidateMatchMapMemoryAfterDbWrite();
  return upserted;
}

export async function listAmistososAdminMatches(): Promise<AmistososAdminMatchRow[]> {
  await ensureAmistososFriendliesMatchesSeeded();
  const pool = getPool();
  const competitionId = getAmistososFriendliesCompetitionId();
  const ids = AMISTOSOS_FRIENDLY_MATCHES.map((m) => m.matchId);

  const { rows } = await pool.query<{
    match_id: number;
    date_br: string;
    hour_br: string;
    home_name: string;
    away_name: string;
    home_sigla: string;
    away_sigla: string;
    home_logo: string | null;
    away_logo: string | null;
    status: string;
    result_casa: number | null;
    result_visitante: number | null;
  }>(
    `SELECT match_id, date_br, hour_br,
            home_name, away_name, home_sigla, away_sigla,
            home_logo, away_logo, status, result_casa, result_visitante
     FROM matches_cache
     WHERE competition_id = $1 AND match_id = ANY($2::int[])
     ORDER BY hour_br ASC`,
    [competitionId, ids],
  );

  return rows.map((r) => ({
    matchId: Number(r.match_id),
    dateBr: r.date_br,
    hourBr: r.hour_br,
    homeName: r.home_name,
    awayName: r.away_name,
    homeSigla: r.home_sigla,
    awaySigla: r.away_sigla,
    homeLogo: r.home_logo,
    awayLogo: r.away_logo,
    status: r.status,
    resultCasa: r.result_casa,
    resultVisitante: r.result_visitante,
  }));
}
