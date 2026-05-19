/**
 * Arquitetura v2 — helpers para o "Ticket Extra por Rodada".
 *
 * Substitui o conceito antigo de "ticket extra = campeonato inteiro" por
 * "ticket extra = uma RODADA especifica de um campeonato extra".
 *
 * Aqui ficam apenas funcoes de leitura/escrita:
 *   - resolveCurrentExtraRound(competitionId) -> numero da rodada ativa
 *     (preferencia 1: snapshot championships_cache; fallback: provider).
 *   - listMatchesForExtraRound(competitionId, rodada) -> partidas da rodada
 *     direto do matches_cache (filtradas por `rodada`).
 *
 * Sem mudancas em checkout / UI / ranking neste PR — esses passos consomem
 * estes helpers em uma proxima etapa.
 */

import { getPool } from "@/lib/db";
import { fetchChampionshipSnapshot } from "@/lib/football/provider";
import {
  persistChampionshipSnapshot,
  readChampionshipSnapshot,
} from "@/lib/football/persistence";

export type ExtraRoundResolution = {
  competitionId: number;
  rodada: number;
  rodadaSlug: string | null;
  rodadaNome: string | null;
  rodadaStatus: string | null;
  championshipNome: string;
  championshipSlug: string;
  championshipTemporada: string | null;
};

export async function resolveCurrentExtraRound(
  competitionId: number,
  opts?: { allowProviderCall?: boolean },
): Promise<ExtraRoundResolution | null> {
  // 1) cache
  const cached = await readChampionshipSnapshot(competitionId);
  if (cached && cached.rodada_atual_numero != null) {
    return {
      competitionId,
      rodada: cached.rodada_atual_numero,
      rodadaSlug: cached.rodada_atual_slug,
      rodadaNome: cached.rodada_atual_nome,
      rodadaStatus: cached.rodada_atual_status,
      championshipNome: cached.nome,
      championshipSlug: cached.slug,
      championshipTemporada: cached.temporada,
    };
  }
  if (opts?.allowProviderCall === false) return null;

  // 2) fallback: provider
  try {
    const snap = await fetchChampionshipSnapshot(competitionId);
    await persistChampionshipSnapshot(snap).catch(() => {});
    if (!snap.rodadaAtual?.numero) return null;
    return {
      competitionId,
      rodada: snap.rodadaAtual.numero,
      rodadaSlug: snap.rodadaAtual.slug,
      rodadaNome: snap.rodadaAtual.nome,
      rodadaStatus: snap.rodadaAtual.status,
      championshipNome: snap.nome,
      championshipSlug: snap.slug,
      championshipTemporada: snap.temporada,
    };
  } catch {
    return null;
  }
}

export type ExtraRoundMatchRow = {
  competition_id: number;
  match_id: number;
  slug: string | null;
  status: string;
  kickoff_at: string | null;
  date_br: string;
  hour_br: string;
  result_casa: number | null;
  result_visitante: number | null;
  rodada: number | null;
  rodada_slug: string | null;
  home_team_id: number | null;
  home_name: string;
  home_sigla: string;
  home_logo: string | null;
  away_team_id: number | null;
  away_name: string;
  away_sigla: string;
  away_logo: string | null;
  estadio_nome: string | null;
  disputa_penalti: boolean | null;
};

export async function listMatchesForExtraRound(
  competitionId: number,
  rodada: number,
): Promise<ExtraRoundMatchRow[]> {
  const pool = getPool();
  const { rows } = await pool.query<ExtraRoundMatchRow>(
    `SELECT
       competition_id, match_id, slug, status,
       kickoff_at::text AS kickoff_at,
       date_br, hour_br,
       result_casa, result_visitante,
       rodada, rodada_slug,
       home_team_id, home_name, home_sigla, home_logo,
       away_team_id, away_name, away_sigla, away_logo,
       estadio_nome, disputa_penalti
     FROM matches_cache
     WHERE competition_id = $1
       AND rodada = $2
     ORDER BY kickoff_at ASC NULLS LAST, match_id ASC`,
    [competitionId, rodada],
  );
  return rows;
}

/**
 * Resumo: para cada competicao extra configurada, qual a rodada atual e quantas
 * partidas estao no cache para essa rodada. Util para a tela de loja /tickets
 * exibir "Ticket Extra — Rodada X" dinamicamente.
 */
export async function listExtraRoundsSnapshot(
  competitionIds: number[],
): Promise<
  Array<{
    competitionId: number;
    championshipNome: string;
    rodada: number | null;
    rodadaNome: string | null;
    matchCount: number;
  }>
> {
  const out: Array<{
    competitionId: number;
    championshipNome: string;
    rodada: number | null;
    rodadaNome: string | null;
    matchCount: number;
  }> = [];
  for (const id of competitionIds) {
    const resolved = await resolveCurrentExtraRound(id, { allowProviderCall: false });
    if (!resolved) {
      out.push({
        competitionId: id,
        championshipNome: `Campeonato ${id}`,
        rodada: null,
        rodadaNome: null,
        matchCount: 0,
      });
      continue;
    }
    const matches = await listMatchesForExtraRound(id, resolved.rodada);
    out.push({
      competitionId: id,
      championshipNome: resolved.championshipNome,
      rodada: resolved.rodada,
      rodadaNome: resolved.rodadaNome,
      matchCount: matches.length,
    });
  }
  return out;
}
