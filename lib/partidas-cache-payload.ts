import { readMatchesCache, type CachedMatchRow } from "@/lib/matches-cache";

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
    status: row.status,
    data_realizacao: dateBR,
    hora_realizacao: hourBR,
    data_realizacao_iso: row.kickoff_at,
    placar_mandante: row.result_casa,
    placar_visitante: row.result_visitante,
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
  const stableRows = [...rows].sort((a, b) => a.match_id - b.match_id);
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

/** Mesmo formato do GET /api/partidas, montado só a partir do Postgres (sem API futebol). */
export async function getPartidasFasesFromDb(): Promise<PhaseMap> {
  const rows = await readMatchesCache();
  return buildPartidasFasesFromRows(rows);
}
