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
import {
  fetchChampionshipSnapshot,
  fetchRodadaMatches,
  type ChampionshipSnapshotV2,
} from "@/lib/football/provider";
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

function isExtraRodadaEncerrada(status: string | null | undefined): boolean {
  const s = String(status ?? "").toLowerCase();
  return (
    s.includes("encerr") ||
    s.includes("finaliz") ||
    s === "final" ||
    s === "fechad"
  );
}

function isExtraMatchOpen(status: string | null | undefined): boolean {
  const s = String(status ?? "").toLowerCase();
  return !(
    s.includes("encerr") ||
    s.includes("finaliz") ||
    s === "final" ||
    s.includes("cancel")
  );
}

function resolutionFromSnapshot(
  competitionId: number,
  snap: Pick<
    ChampionshipSnapshotV2,
    "nome" | "slug" | "temporada" | "rodadaAtual"
  >,
): ExtraRoundResolution | null {
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
}

/**
 * API-Futebol mantém `rodada_atual` na última rodada encerrada até atualizar o
 * snapshot (ex.: Premier 37 encerrada enquanto a 38 já está agendada). Avança
 * para rodada+1 quando a atual está encerrada e a próxima tem jogos abertos.
 */
async function advanceExtraRoundIfCurrentClosed(
  base: ExtraRoundResolution,
  opts?: { allowProviderCall?: boolean },
): Promise<ExtraRoundResolution> {
  if (!isExtraRodadaEncerrada(base.rodadaStatus)) return base;

  const next = base.rodada + 1;
  const cachedNext = await listMatchesForExtraRound(base.competitionId, next);
  if (cachedNext.some((m) => isExtraMatchOpen(m.status))) {
    const slug = cachedNext.find((m) => m.rodada_slug)?.rodada_slug;
    return {
      ...base,
      rodada: next,
      rodadaSlug: slug ?? `rodada-${next}`,
      rodadaNome: `${next}ª Rodada`,
      rodadaStatus: "agendada",
    };
  }

  if (opts?.allowProviderCall === false) return base;

  try {
    const partidas = await fetchRodadaMatches(base.competitionId, next, {
      nome: base.championshipNome,
      slug: base.championshipSlug,
      temporada: base.championshipTemporada,
    });
    if (!partidas.some((p) => isExtraMatchOpen(p.status))) return base;
    const slug = partidas.find((p) => p.rodadaSlug)?.rodadaSlug ?? `${next}a-rodada`;
    if (process.env.DEBUG_FOOTBALL_API === "true" || process.env.DEBUG_BOLAOES === "true") {
      console.error(
        `[extras-rodada] ${base.competitionId}: rodada ${base.rodada} encerrada → usando ${next} (${partidas.length} jogos na API)`,
      );
    }
    return {
      ...base,
      rodada: next,
      rodadaSlug: slug,
      rodadaNome: `${next}ª Rodada`,
      rodadaStatus: "agendada",
    };
  } catch {
    return base;
  }
}

/**
 * Rodada usada na UI e em palpites para um ticket extra com `round_number` fixo.
 * Mantém a rodada gravada na cota (ex.: 12ª Série B) mesmo quando o campeonato
 * já avançou para a rodada seguinte na API.
 */
export async function resolveEffectiveExtraRoundForTicket(
  competitionId: number,
  ticketRoundNumber: number | null,
  opts?: { allowProviderCall?: boolean },
): Promise<ExtraRoundResolution | null> {
  const current = await resolveCurrentExtraRound(competitionId, opts);
  if (!current) {
    if (
      ticketRoundNumber != null &&
      Number.isFinite(ticketRoundNumber) &&
      ticketRoundNumber > 0
    ) {
      return {
        competitionId,
        rodada: ticketRoundNumber,
        rodadaSlug: null,
        rodadaNome: `${ticketRoundNumber}ª Rodada`,
        rodadaStatus: null,
        championshipNome: `Campeonato ${competitionId}`,
        championshipSlug: `comp-${competitionId}`,
        championshipTemporada: null,
      };
    }
    return null;
  }

  if (
    ticketRoundNumber == null ||
    !Number.isFinite(ticketRoundNumber) ||
    ticketRoundNumber <= 0
  ) {
    return current;
  }

  if (ticketRoundNumber === current.rodada) {
    return {
      ...current,
      rodadaNome: current.rodadaNome ?? `${ticketRoundNumber}ª Rodada`,
    };
  }

  // Cota paga com rodada fixa (ex.: Série B 12ª): mantém a rodada do ticket
  // para palpites, pontuação e ranking — não avança para rodada_atual da API.
  return {
    ...current,
    rodada: ticketRoundNumber,
    rodadaSlug: current.rodadaSlug,
    rodadaNome: `${ticketRoundNumber}ª Rodada`,
    rodadaStatus: null,
  };
}

export async function resolveCurrentExtraRound(
  competitionId: number,
  opts?: { allowProviderCall?: boolean },
): Promise<ExtraRoundResolution | null> {
  const allowProvider = opts?.allowProviderCall === true;

  // 1) cache (sem rodada no cache → tenta provider para derivar da fase, ex. Libertadores)
  const cached = await readChampionshipSnapshot(competitionId);
  if (cached && cached.rodada_atual_numero != null) {
    const base: ExtraRoundResolution = {
      competitionId,
      rodada: cached.rodada_atual_numero,
      rodadaSlug: cached.rodada_atual_slug,
      rodadaNome: cached.rodada_atual_nome,
      rodadaStatus: cached.rodada_atual_status,
      championshipNome: cached.nome,
      championshipSlug: cached.slug,
      championshipTemporada: cached.temporada,
    };
    return advanceExtraRoundIfCurrentClosed(base, {
      allowProviderCall: allowProvider,
    });
  }
  if (!allowProvider) return null;

  // 2) fallback: provider
  try {
    const snap = await fetchChampionshipSnapshot(competitionId);
    await persistChampionshipSnapshot(snap).catch(() => {});
    const base = resolutionFromSnapshot(competitionId, snap);
    if (!base) return null;
    return advanceExtraRoundIfCurrentClosed(base, {
      allowProviderCall: allowProvider,
    });
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
