/**
 * Bolão manual "Amistosos — dia 6" (sem sync API).
 * Apenas jogos com Brasil, Portugal, Alemanha, Argentina e Inglaterra.
 */

import { resolveNationalTeamShieldUrl } from "@/lib/football/national-team-shields";

function envInt(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name]?.trim() ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** ID sintético em `matches_cache.competition_id` (não sincronizar pela API). */
export function getAmistososFriendliesCompetitionId(): number {
  return envInt("AMISTOSOS_FRIENDLIES_COMPETITION_ID", 90006);
}

export const AMISTOSOS_FRIENDLIES_ROUND = 1;
export const AMISTOSOS_FRIENDLIES_DATE_BR = "06/06/2026";
export const AMISTOSOS_FRIENDLIES_DISPLAY_NAME = "Bolão dos Amistosos";
export const AMISTOSOS_FRIENDLIES_SUBTITLE =
  "Início 06/06 · amistosos internacionais do dia";

export type AmistososFriendlyMatchDef = {
  matchId: number;
  hourBr: string;
  homeName: string;
  awayName: string;
  homeSigla: string;
  awaySigla: string;
};

/** Jogos do bolão (seleções participantes). */
export const AMISTOSOS_FRIENDLY_MATCHES: readonly AmistososFriendlyMatchDef[] = [
  {
    matchId: 90606001,
    hourBr: "14:45",
    homeName: "Portugal",
    awayName: "Chile",
    homeSigla: "POR",
    awaySigla: "CHI",
  },
  {
    matchId: 90606002,
    hourBr: "15:30",
    homeName: "Estados Unidos",
    awayName: "Alemanha",
    homeSigla: "EUA",
    awaySigla: "ALE",
  },
  {
    matchId: 90606003,
    hourBr: "17:00",
    homeName: "Inglaterra",
    awayName: "Nova Zelândia",
    homeSigla: "ING",
    awaySigla: "NZL",
  },
  {
    matchId: 90606004,
    hourBr: "19:00",
    homeName: "Brasil",
    awayName: "Marrocos",
    homeSigla: "BRA",
    awaySigla: "MAR",
  },
  {
    matchId: 90606005,
    hourBr: "21:00",
    homeName: "Argentina",
    awayName: "Honduras",
    homeSigla: "ARG",
    awaySigla: "HON",
  },
] as const;

export function isAmistososFriendliesCompetition(
  competitionId: number | null | undefined,
): boolean {
  if (competitionId == null || !Number.isFinite(Number(competitionId))) return false;
  return Number(competitionId) === getAmistososFriendliesCompetitionId();
}

export function isSerieBExtraGiftChampionship(championshipId: number): boolean {
  const configured = envInt("SERIE_B_EXTRA_CHAMPIONSHIP_ID", 14);
  return championshipId === configured;
}

export function amistososMatchToCacheRow(m: AmistososFriendlyMatchDef) {
  const competitionId = getAmistososFriendliesCompetitionId();
  return {
    competitionId,
    matchId: m.matchId,
    dateBr: AMISTOSOS_FRIENDLIES_DATE_BR,
    hourBr: m.hourBr,
    homeName: m.homeName,
    homeSigla: m.homeSigla,
    homeLogo: resolveNationalTeamShieldUrl(m.homeName),
    awayName: m.awayName,
    awaySigla: m.awaySigla,
    awayLogo: resolveNationalTeamShieldUrl(m.awayName),
    rodada: AMISTOSOS_FRIENDLIES_ROUND,
    status: "Agendada",
    championshipName: AMISTOSOS_FRIENDLIES_DISPLAY_NAME,
  };
}
