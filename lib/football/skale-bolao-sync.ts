/**
 * Espelha partidas da Copa (comp 72) no bolão sintético da Skale.
 * Mantém placares, status e kickoff sincronizados com o principal.
 */

import { getPool } from "@/lib/db";
import { invalidateMatchMapMemoryAfterDbWrite } from "@/lib/match-map-cache-invalidator";
import {
  getSkaleBolaoCompetitionId,
  getSkaleBolaoSourceCopaCompetitionId,
  isSkaleBolaoEnabled,
  SKALE_BOLAO_DISPLAY_NAME,
} from "@/lib/boloes/skale-config";

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
  -- Gambiarra: só sábado (6) e domingo (0), horário BRT
  AND EXTRACT(DOW FROM (kickoff_at AT TIME ZONE 'America/Sao_Paulo')) IN (0, 6)
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

const UPSERT_CHAMPIONSHIP_SQL = `
INSERT INTO championships_cache (
  competition_id, nome, slug, nome_popular, temporada,
  rodada_atual_numero, rodada_atual_slug, rodada_atual_nome, rodada_atual_status,
  fase_atual_nome, fase_atual_slug, status, logo, total_rodadas,
  raw_payload, fetched_at
)
SELECT
  $1::int,
  $2::text,
  COALESCE(slug, 'skale-copa'),
  nome_popular,
  temporada,
  rodada_atual_numero,
  rodada_atual_slug,
  rodada_atual_nome,
  rodada_atual_status,
  fase_atual_nome,
  fase_atual_slug,
  status,
  logo,
  total_rodadas,
  raw_payload,
  now()
FROM championships_cache
WHERE competition_id = $3::int
ON CONFLICT (competition_id)
DO UPDATE SET
  nome = EXCLUDED.nome,
  slug = COALESCE(EXCLUDED.slug, championships_cache.slug),
  nome_popular = COALESCE(EXCLUDED.nome_popular, championships_cache.nome_popular),
  temporada = COALESCE(EXCLUDED.temporada, championships_cache.temporada),
  rodada_atual_numero = COALESCE(EXCLUDED.rodada_atual_numero, championships_cache.rodada_atual_numero),
  rodada_atual_slug = COALESCE(EXCLUDED.rodada_atual_slug, championships_cache.rodada_atual_slug),
  rodada_atual_nome = COALESCE(EXCLUDED.rodada_atual_nome, championships_cache.rodada_atual_nome),
  rodada_atual_status = COALESCE(EXCLUDED.rodada_atual_status, championships_cache.rodada_atual_status),
  fase_atual_nome = COALESCE(EXCLUDED.fase_atual_nome, championships_cache.fase_atual_nome),
  fase_atual_slug = COALESCE(EXCLUDED.fase_atual_slug, championships_cache.fase_atual_slug),
  status = COALESCE(EXCLUDED.status, championships_cache.status),
  logo = COALESCE(EXCLUDED.logo, championships_cache.logo),
  total_rodadas = COALESCE(EXCLUDED.total_rodadas, championships_cache.total_rodadas),
  raw_payload = COALESCE(EXCLUDED.raw_payload, championships_cache.raw_payload),
  fetched_at = now()
`;

export type SkaleBolaoSyncResult = {
  skaleCompetitionId: number;
  sourceCompetitionId: number;
  matchesMirrored: number;
  ms: number;
};

export async function mirrorSkaleBolaoMatchesFromCopa(): Promise<SkaleBolaoSyncResult | null> {
  if (!isSkaleBolaoEnabled()) return null;

  const t0 = Date.now();
  const skaleId = getSkaleBolaoCompetitionId();
  const copaId = getSkaleBolaoSourceCopaCompetitionId();
  const pool = getPool();

  await pool.query(UPSERT_CHAMPIONSHIP_SQL, [
    skaleId,
    SKALE_BOLAO_DISPLAY_NAME,
    copaId,
  ]);

  const result = await pool.query(MIRROR_MATCHES_SQL, [
    skaleId,
    copaId,
    SKALE_BOLAO_DISPLAY_NAME,
  ]);

  // Gambiarra: remove do bolão qualquer jogo já espelhado que NÃO seja sáb/dom.
  await pool.query(
    `DELETE FROM matches_cache
     WHERE competition_id = $1::int
       AND (
         kickoff_at IS NULL
         OR EXTRACT(DOW FROM (kickoff_at AT TIME ZONE 'America/Sao_Paulo')) NOT IN (0, 6)
       )`,
    [skaleId],
  );

  invalidateMatchMapMemoryAfterDbWrite();

  return {
    skaleCompetitionId: skaleId,
    sourceCompetitionId: copaId,
    matchesMirrored: result.rowCount ?? 0,
    ms: Date.now() - t0,
  };
}
