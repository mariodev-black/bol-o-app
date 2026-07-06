/* eslint-disable @typescript-eslint/no-explicit-any */
/** Extração de placar e apito a partir do JSON da API Futebol / payloads espelhados no cache. */

import {
  hasOfficialMatchResult,
  isFinishedMatchStatus,
} from "@/lib/palpites-match-open";

type GolRow = {
  periodo?: string;
  periodo_slug?: string;
  penalti?: boolean;
  gol_contra?: boolean;
};

function normalizePeriodText(...parts: (string | null | undefined)[]): string {
  return parts
    .map((p) => String(p ?? ""))
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Gol válido para o bolão: 1º/2º tempo e acréscimos — não prorrogação nem disputa de pênaltis. */
export function isRegulationGoalPeriod(
  periodoSlug?: string | null,
  periodo?: string | null,
): boolean {
  const s = normalizePeriodText(periodoSlug, periodo);
  if (!s.trim()) return false;
  if (s.includes("prorrog")) return false;
  if (s.includes("penalt")) return false;
  if (s.includes("disputa")) return false;
  return (
    s.includes("primeiro") ||
    s.includes("segundo") ||
    s.includes("acrescim")
  );
}

/** Conta gols apenas do tempo regulamentar a partir do detalhamento `gols` da API. */
export function countRegulationGoalsFromPartidaPayload(
  p: any,
): { casa: number; visita: number } | null {
  const gols = p?.gols;
  if (!gols || typeof gols !== "object") return null;
  const mandante = Array.isArray(gols.mandante) ? (gols.mandante as GolRow[]) : [];
  const visitante = Array.isArray(gols.visitante) ? (gols.visitante as GolRow[]) : [];
  if (mandante.length === 0 && visitante.length === 0) return null;

  let casa = 0;
  let visita = 0;

  for (const g of mandante) {
    if (g.penalti) continue;
    if (!isRegulationGoalPeriod(g.periodo_slug, g.periodo)) continue;
    if (g.gol_contra) visita += 1;
    else casa += 1;
  }
  for (const g of visitante) {
    if (g.penalti) continue;
    if (!isRegulationGoalPeriod(g.periodo_slug, g.periodo)) continue;
    if (g.gol_contra) casa += 1;
    else visita += 1;
  }

  return { casa, visita };
}

export function partidaHasExtraTimeGoals(p: any): boolean {
  const gols = p?.gols;
  if (!gols || typeof gols !== "object") return false;
  const all = [
    ...(Array.isArray(gols.mandante) ? gols.mandante : []),
    ...(Array.isArray(gols.visitante) ? gols.visitante : []),
  ] as GolRow[];
  return all.some((g) => {
    const s = normalizePeriodText(g.periodo_slug, g.periodo);
    return s.includes("prorrog");
  });
}

function isExtraTimeMatchStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s.includes("prorrog") || s.includes("extra time");
}

function parseScoresFromPlacarString(raw: unknown): { casa: number; visita: number } | null {
  if (typeof raw !== "string") return null;
  const matches = [...raw.matchAll(/(\d+)\s*[xX]\s*(\d+)/g)];
  if (matches.length === 0) return null;
  const m = matches[matches.length - 1]!;
  const casa = Number(m[1]);
  const visita = Number(m[2]);
  if (!Number.isFinite(casa) || !Number.isFinite(visita)) return null;
  if (casa > 30 || visita > 30) return null;
  return { casa, visita };
}

export function parseKickoffFromPartidaPayload(p: any): string | null {
  const iso = p?.data_realizacao_iso;
  if (iso != null && String(iso).trim() !== "") {
    const parsed = new Date(String(iso));
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const dataRealizacao = p?.data_realizacao;
  const hora = p?.hora_realizacao;
  if (!dataRealizacao || !hora) return null;
  const [d, m, y] = String(dataRealizacao).split("/");
  if (!d || !m || !y) return null;
  const hhmm = String(hora).slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${hhmm}:00-03:00`;
}

function pickRawScoreFromPartidaPayload(p: any, side: "casa" | "visitante"): number | null {
  const casaKeys = [
    "placar_mandante",
    "placar_casa",
    "placar_oficial_mandante",
    "gols_mandante",
    "resultado_mandante",
  ];
  const visitKeys = [
    "placar_visitante",
    "placar_oficial_visitante",
    "gols_visitante",
    "resultado_visitante",
  ];
  const keys = side === "casa" ? casaKeys : visitKeys;
  for (const k of keys) {
    const v = p?.[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  const parsed = parseScoresFromPlacarString(p?.placar);
  if (parsed) return side === "casa" ? parsed.casa : parsed.visita;
  return null;
}

export function pickScoreFromPartidaPayload(p: any, side: "casa" | "visitante"): number | null {
  const status = String(p?.status ?? "");
  const kickoffAt = parseKickoffFromPartidaPayload(p);
  const inExtraTime =
    isExtraTimeMatchStatus(status) || partidaHasExtraTimeGoals(p);
  const regulation = countRegulationGoalsFromPartidaPayload(p);

  if (
    regulation != null &&
    (isFinishedMatchStatus(status) || inExtraTime)
  ) {
    const resultCasa = regulation.casa;
    const resultVisitante = regulation.visita;
    if (
      isFinishedMatchStatus(status) &&
      !hasOfficialMatchResult({ status, kickoffAt, resultCasa, resultVisitante })
    ) {
      return null;
    }
    return side === "casa" ? resultCasa : resultVisitante;
  }

  const resultCasa = pickRawScoreFromPartidaPayload(p, "casa");
  const resultVisitante = pickRawScoreFromPartidaPayload(p, "visitante");
  if (resultCasa == null || resultVisitante == null) return null;
  if (
    !hasOfficialMatchResult({ status, kickoffAt, resultCasa, resultVisitante })
  ) {
    return null;
  }
  return side === "casa" ? resultCasa : resultVisitante;
}
