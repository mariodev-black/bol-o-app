import { readMatchesCache, type CachedMatchRow } from "@/lib/matches-cache";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { isAmistososFriendliesCompetition } from "@/lib/football/amistosos-friendlies";
import { ensureAmistososFriendliesMatchesSeeded } from "@/lib/football/amistosos-friendlies-persistence";
import { syncAllConfiguredIfStale } from "@/lib/football/sync-orchestrator";

type NestedRounds = Record<string, Array<Record<string, unknown>>>;
type PhaseMap = Record<string, NestedRounds | Record<string, NestedRounds>>;

function brDateFromIso(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(dt);
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  if (!day || !month || !year) return "";
  return `${day}/${month}/${year}`;
}

function brHourFromIso(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "--:--";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dt);
}

export function rowToPartidaPayload(row: CachedMatchRow): Record<string, unknown> {
  let dateBR = String(row.date_br ?? "").trim();
  const hourRaw = String(row.hour_br ?? "").trim();
  if ((!dateBR || dateBR === "undefined" || dateBR === "null") && row.kickoff_at) {
    dateBR = brDateFromIso(row.kickoff_at);
  }
  const hourBR =
    /^\d{2}:\d{2}$/.test(hourRaw.slice(0, 5))
      ? hourRaw.slice(0, 5)
      : row.kickoff_at
        ? brHourFromIso(row.kickoff_at)
        : "--:--";
  return {
    partida_id: row.match_id,
    competition_id: row.competition_id,
    status: row.status,
    data_realizacao: dateBR,
    hora_realizacao: hourBR,
    data_realizacao_iso: row.kickoff_at,
    placar_mandante: row.result_casa,
    placar_visitante: row.result_visitante,
    // `rodada` (numero real) vem da coluna `matches_cache.rodada` quando
    // populada pelo sync v2; caso null para extras legados, o parser do
    // cliente cai no `round_key` (ex.: "17a-rodada" → 17).
    rodada: row.rodada ?? null,
    round_key: row.round_key ?? null,
    time_mandante: {
      nome_popular: row.home_name,
      sigla: row.home_sigla,
      escudo: row.home_logo,
    },
    time_visitante: {
      nome_popular: row.away_name,
      sigla: row.away_sigla,
      escudo: row.away_logo,
    },
  };
}

export function buildPartidasFasesFromRows(rows: CachedMatchRow[]): PhaseMap {
  // Ordena cronologicamente por kickoff_at (asc) → garante que a UI exiba os
  // jogos da rodada no mesmo ordem da api-futebol (ex.: 23/05 17:00 antes de
  // 25/05 20:00). `match_id` é desempate estável quando o kickoff for igual ou
  // ausente em dados legados.
  const stableRows = [...rows].sort((a, b) => {
    const ka = a.kickoff_at ? Date.parse(a.kickoff_at) : Number.POSITIVE_INFINITY;
    const kb = b.kickoff_at ? Date.parse(b.kickoff_at) : Number.POSITIVE_INFINITY;
    if (Number.isFinite(ka) && Number.isFinite(kb) && ka !== kb) return ka - kb;
    return a.match_id - b.match_id;
  });
  const fases: PhaseMap = {};
  for (const row of stableRows) {
    const phaseKey = row.phase_key || "geral";
    const groupKey = row.group_key || "grupo-geral";
    const roundKey = row.round_key || "rodada-unica";

    if (!fases[phaseKey]) fases[phaseKey] = {};
    if (row.group_key) {
      const phaseObj = fases[phaseKey] as Record<string, NestedRounds>;
      if (!phaseObj[groupKey]) phaseObj[groupKey] = {};
      if (!phaseObj[groupKey][roundKey]) phaseObj[groupKey][roundKey] = [];
      phaseObj[groupKey][roundKey].push(rowToPartidaPayload(row));
    } else {
      const phaseObj = fases[phaseKey] as NestedRounds;
      if (!phaseObj[roundKey]) phaseObj[roundKey] = [];
      phaseObj[roundKey].push(rowToPartidaPayload(row));
    }
  }
  return fases;
}

/**
 * Mesmo formato do GET /api/partidas, montado só a partir do Postgres (sem API futebol).
 * Por omissão usa o campeonato principal (alinhado ao default de `/api/partidas`).
 */
export async function getPartidasFasesFromDb(competitionId?: number): Promise<PhaseMap> {
  const comp =
    competitionId != null && Number.isFinite(Number(competitionId))
      ? Number(competitionId)
      : getFootballMainCompetitionId();
  let rows = await readMatchesCache();
  let filtered = rows.filter((r) => Number(r.competition_id) === comp);
  if (filtered.length === 0 && isAmistososFriendliesCompetition(comp)) {
    await ensureAmistososFriendliesMatchesSeeded().catch(() => {});
    rows = await readMatchesCache();
    filtered = rows.filter((r) => Number(r.competition_id) === comp);
  }
  if (filtered.length === 0) {
    await syncAllConfiguredIfStale().catch(() => {});
    rows = await readMatchesCache();
    filtered = rows.filter((r) => Number(r.competition_id) === comp);
  }
  return buildPartidasFasesFromRows(filtered);
}
