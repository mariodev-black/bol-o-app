/**
 * Espelha os jogos da Copa (comp 72) de SÁBADO e DOMINGO no bolão sintético
 * "Copa – Sábado e Domingo" (comp próprio). Mantém placares/status sincronizados.
 * Separado do Skale: comp próprio, não afeta o pool da Skale.
 */

import { getPool } from "@/lib/db";
import { invalidateMatchMapMemoryAfterDbWrite } from "@/lib/match-map-cache-invalidator";
import {
  getWeekendBolaoCompetitionId,
  getWeekendBolaoSourceCopaCompetitionId,
  isWeekendBolaoEnabled,
  WEEKEND_BOLAO_DISPLAY_NAME,
} from "@/lib/boloes/weekend-bolao-config";

const MIRROR_MATCHES_SQL = `
INSERT INTO matches_cache (
  competition_id, match_id,
  phase_key, group_key, round_key,
  status, kickoff_at,
  date_br, hour_br,
  result_casa, result_visitante,
  home_name, home_sigla, home_logo,
  away_name, away_sigla, away_logo,
  slug, disputa_penalti, penaltis_casa, penaltis_visitante,
  data_realizacao_iso, rodada, rodada_slug, fase_nome, fase_slug,
  championship_name, championship_slug, championship_temporada,
  home_team_id, away_team_id, estadio_id, estadio_nome, provider_payload,
  source_updated_at, synced_at
)
SELECT
  $1::int, match_id,
  phase_key, group_key, round_key,
  status, kickoff_at,
  date_br, hour_br,
  result_casa, result_visitante,
  home_name, home_sigla, home_logo,
  away_name, away_sigla, away_logo,
  slug, disputa_penalti, penaltis_casa, penaltis_visitante,
  data_realizacao_iso, rodada, rodada_slug, fase_nome, fase_slug,
  $3::text, championship_slug, championship_temporada,
  home_team_id, away_team_id, estadio_id, estadio_nome, provider_payload,
  source_updated_at, now()
FROM matches_cache
WHERE competition_id = $2::int
  AND kickoff_at IS NOT NULL
  -- só sábado (6) e domingo (0), horário BRT
  AND EXTRACT(DOW FROM (kickoff_at AT TIME ZONE 'America/Sao_Paulo')) IN (0, 6)
  -- apenas a rodada (1 fim de semana): janela [from, to)
  AND (kickoff_at AT TIME ZONE 'America/Sao_Paulo')::date >= $4::date
  AND (kickoff_at AT TIME ZONE 'America/Sao_Paulo')::date <  $5::date
ON CONFLICT (competition_id, match_id)
DO UPDATE SET
  phase_key                = COALESCE(EXCLUDED.phase_key, matches_cache.phase_key),
  group_key                = COALESCE(EXCLUDED.group_key, matches_cache.group_key),
  round_key                = COALESCE(EXCLUDED.round_key, matches_cache.round_key),
  status                   = EXCLUDED.status,
  kickoff_at               = COALESCE(EXCLUDED.kickoff_at, matches_cache.kickoff_at),
  date_br                  = COALESCE(NULLIF(EXCLUDED.date_br, ''), matches_cache.date_br),
  hour_br                  = COALESCE(NULLIF(EXCLUDED.hour_br, ''), matches_cache.hour_br),
  result_casa              = COALESCE(EXCLUDED.result_casa, matches_cache.result_casa),
  result_visitante         = COALESCE(EXCLUDED.result_visitante, matches_cache.result_visitante),
  home_name                = COALESCE(EXCLUDED.home_name, matches_cache.home_name),
  home_sigla               = COALESCE(EXCLUDED.home_sigla, matches_cache.home_sigla),
  home_logo                = COALESCE(EXCLUDED.home_logo, matches_cache.home_logo),
  away_name                = COALESCE(EXCLUDED.away_name, matches_cache.away_name),
  away_sigla               = COALESCE(EXCLUDED.away_sigla, matches_cache.away_sigla),
  away_logo                = COALESCE(EXCLUDED.away_logo, matches_cache.away_logo),
  slug                     = COALESCE(EXCLUDED.slug, matches_cache.slug),
  disputa_penalti          = COALESCE(EXCLUDED.disputa_penalti, matches_cache.disputa_penalti),
  penaltis_casa            = COALESCE(EXCLUDED.penaltis_casa, matches_cache.penaltis_casa),
  penaltis_visitante       = COALESCE(EXCLUDED.penaltis_visitante, matches_cache.penaltis_visitante),
  data_realizacao_iso      = COALESCE(EXCLUDED.data_realizacao_iso, matches_cache.data_realizacao_iso),
  rodada                   = COALESCE(EXCLUDED.rodada, matches_cache.rodada),
  rodada_slug              = COALESCE(EXCLUDED.rodada_slug, matches_cache.rodada_slug),
  fase_nome                = COALESCE(EXCLUDED.fase_nome, matches_cache.fase_nome),
  fase_slug                = COALESCE(EXCLUDED.fase_slug, matches_cache.fase_slug),
  championship_name        = EXCLUDED.championship_name,
  championship_slug        = COALESCE(EXCLUDED.championship_slug, matches_cache.championship_slug),
  championship_temporada   = COALESCE(EXCLUDED.championship_temporada, matches_cache.championship_temporada),
  home_team_id             = COALESCE(EXCLUDED.home_team_id, matches_cache.home_team_id),
  away_team_id             = COALESCE(EXCLUDED.away_team_id, matches_cache.away_team_id),
  estadio_id               = COALESCE(EXCLUDED.estadio_id, matches_cache.estadio_id),
  estadio_nome             = COALESCE(EXCLUDED.estadio_nome, matches_cache.estadio_nome),
  provider_payload         = COALESCE(EXCLUDED.provider_payload, matches_cache.provider_payload),
  source_updated_at        = now(),
  synced_at                = now()
`;

/** Remove do bolão tudo que não seja sáb/dom DA RODADA (janela [from, to)). */
const CLEANUP_SQL = `
DELETE FROM matches_cache
WHERE competition_id = $1::int
  AND (
    kickoff_at IS NULL
    OR EXTRACT(DOW FROM (kickoff_at AT TIME ZONE 'America/Sao_Paulo')) NOT IN (0, 6)
    OR (kickoff_at AT TIME ZONE 'America/Sao_Paulo')::date <  $2::date
    OR (kickoff_at AT TIME ZONE 'America/Sao_Paulo')::date >= $3::date
  )
`;

const UPSERT_CHAMPIONSHIP_SQL = `
INSERT INTO championships_cache (
  competition_id, nome, slug, nome_popular, temporada,
  rodada_atual_numero, rodada_atual_slug, rodada_atual_nome, rodada_atual_status,
  fase_atual_nome, fase_atual_slug, status, logo, total_rodadas,
  raw_payload, fetched_at
)
SELECT
  $1::int, $2::text, COALESCE(slug, 'copa-fds'), nome_popular, temporada,
  rodada_atual_numero, rodada_atual_slug, rodada_atual_nome, rodada_atual_status,
  fase_atual_nome, fase_atual_slug, status, logo, total_rodadas,
  raw_payload, now()
FROM championships_cache
WHERE competition_id = $3::int
ON CONFLICT (competition_id)
DO UPDATE SET
  nome = EXCLUDED.nome,
  slug = COALESCE(EXCLUDED.slug, championships_cache.slug),
  status = COALESCE(EXCLUDED.status, championships_cache.status),
  logo = COALESCE(EXCLUDED.logo, championships_cache.logo),
  total_rodadas = COALESCE(EXCLUDED.total_rodadas, championships_cache.total_rodadas),
  raw_payload = COALESCE(EXCLUDED.raw_payload, championships_cache.raw_payload),
  fetched_at = now()
`;

export type WeekendBolaoSyncResult = {
  weekendCompetitionId: number;
  sourceCompetitionId: number;
  matchesMirrored: number;
  ms: number;
};

function envDate(name: string): string | null {
  const v = (process.env[name] || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function mirrorWeekendBolaoMatchesFromCopa(): Promise<WeekendBolaoSyncResult | null> {
  if (!isWeekendBolaoEnabled()) return null;

  const t0 = Date.now();
  const compId = getWeekendBolaoCompetitionId();
  const copaId = getWeekendBolaoSourceCopaCompetitionId();
  const pool = getPool();

  // Janela = 1 rodada (sáb+dom). Override por env, senão o fim de semana mais próximo.
  let from = envDate("WEEKEND_BOLAO_DATE_FROM");
  let to = envDate("WEEKEND_BOLAO_DATE_TO");
  if (!from) {
    const { rows } = await pool.query<{ d0: string | null }>(
      `SELECT to_char(MIN((kickoff_at AT TIME ZONE 'America/Sao_Paulo')::date), 'YYYY-MM-DD') AS d0
         FROM matches_cache
        WHERE competition_id = $1::int
          AND kickoff_at >= now() - interval '36 hours'
          AND EXTRACT(DOW FROM (kickoff_at AT TIME ZONE 'America/Sao_Paulo')) IN (0, 6)`,
      [copaId],
    );
    from = rows[0]?.d0 ?? null;
  }
  if (from && !to) to = addDaysIso(from, 2);

  if (!from || !to) {
    // Sem fim de semana próximo — zera o bolão.
    await pool.query(`DELETE FROM matches_cache WHERE competition_id = $1::int`, [compId]);
    invalidateMatchMapMemoryAfterDbWrite();
    return { weekendCompetitionId: compId, sourceCompetitionId: copaId, matchesMirrored: 0, ms: Date.now() - t0 };
  }

  await pool.query(UPSERT_CHAMPIONSHIP_SQL, [compId, WEEKEND_BOLAO_DISPLAY_NAME, copaId]);
  const result = await pool.query(MIRROR_MATCHES_SQL, [
    compId,
    copaId,
    WEEKEND_BOLAO_DISPLAY_NAME,
    from,
    to,
  ]);
  await pool.query(CLEANUP_SQL, [compId, from, to]);

  invalidateMatchMapMemoryAfterDbWrite();

  return {
    weekendCompetitionId: compId,
    sourceCompetitionId: copaId,
    matchesMirrored: result.rowCount ?? 0,
    ms: Date.now() - t0,
  };
}

let ensured: Promise<void> | null = null;
/** Garante o espelhamento ao menos uma vez por processo (idempotente). */
export function ensureWeekendBolaoMatchesMirrored(): Promise<void> {
  if (!ensured) {
    ensured = mirrorWeekendBolaoMatchesFromCopa()
      .then(() => undefined)
      .catch(() => {
        ensured = null;
      });
  }
  return ensured;
}
