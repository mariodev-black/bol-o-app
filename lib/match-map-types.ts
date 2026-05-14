/**
 * Tipos e lookups do mapa de partidas (chave composta campeonato + partida).
 * Módulo sem I/O — seguro para import em Client Components.
 */

export type MatchMapEntry = {
  id: number;
  kickoffAt: string | null;
  status: string;
  resultCasa: number | null;
  resultVisitante: number | null;
  home: string;
  away: string;
  homeName: string;
  awayName: string;
  homeLogo: string | null;
  awayLogo: string | null;
  dateBR: string;
  hour: string;
  /** `matches_cache.competition_id` — necessário para bolões extra. */
  competitionId: number;
};

/** Chave `${competition_id}:${partida_id}` — evita colisão de `partida_id` entre campeonatos na API. */
export type MatchMap = Map<string, MatchMapEntry>;

export function matchMapKey(competitionId: number, matchId: number): string {
  return `${competitionId}:${matchId}`;
}

export function getMatchFromMap(
  map: MatchMap,
  competitionId: number,
  matchId: number
): MatchMapEntry | undefined {
  return map.get(matchMapKey(competitionId, matchId));
}
