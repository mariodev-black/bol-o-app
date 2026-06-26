import type { BolaoDefinition } from "@/lib/boloes/definitions/types";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { type MatchMap, type MatchMapEntry } from "@/lib/football-api";
import {
  isMatchInDailyEditionScope,
  isValidDailyEditionNumber,
} from "@/lib/boloes/daily-editions";
import {
  resolveBolaoMatchFromMap,
  skaleScopeMatchesFromMap,
} from "@/lib/boloes/skale-match-resolve";
import { isSkaleBolaoCompetition } from "@/lib/boloes/skale-config";

function isWeekendDate(dateBR: string): boolean {
  const [d, m, y] = dateBR.split("/").map(Number);
  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) return false;
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
}

/** Partidas válidas para palpites conforme definição admin. */
export function scopeMatchesForBolaoDefinition(
  def: BolaoDefinition,
  matches: MatchMap,
): MatchMapEntry[] {
  const mainComp = getFootballMainCompetitionId();
  const comp = def.competitionId;
  const list =
    isSkaleBolaoCompetition(comp) || def.scopeMode === "daily_dates"
      ? skaleScopeMatchesFromMap(matches, comp)
      : Array.from(matches.values()).filter(
          (m) => (Number(m.competitionId) || comp) === comp,
        );

  switch (def.scopeMode) {
    case "daily_dates": {
      if (
        def.ticketType === "daily" &&
        def.editionNumber != null &&
        isValidDailyEditionNumber(def.editionNumber)
      ) {
        const editionNumber = def.editionNumber;
        return list.filter(
          (m) =>
            m.dateBR != null &&
            isMatchInDailyEditionScope(
              { dateBR: m.dateBR, hour: m.hour, kickoffAt: m.kickoffAt },
              editionNumber,
            ),
        );
      }
      const dateSet = new Set(def.scopeDates);
      return list.filter((m) => m.dateBR != null && dateSet.has(m.dateBR));
    }
    case "round": {
      const round = def.roundNumber;
      if (round == null) return list;
      return list.filter((m) => Number(m.rodada) === round);
    }
    case "weekend":
      return list.filter((m) => m.dateBR != null && isWeekendDate(m.dateBR));
    case "full_competition":
    default:
      if (def.ticketType === "general") {
        return Array.from(matches.values()).filter(
          (m) => (Number(m.competitionId) || mainComp) === mainComp,
        );
      }
      if (isSkaleBolaoCompetition(comp)) {
        return skaleScopeMatchesFromMap(matches, comp);
      }
      return list;
  }
}

export function matchBelongsToBolaoDefinition(
  def: BolaoDefinition,
  matches: MatchMap,
  matchId: number,
): boolean {
  const scoped = scopeMatchesForBolaoDefinition(def, matches);
  return scoped.some((m) => m.id === matchId);
}

export function resolveMatchForDefinition(
  def: BolaoDefinition,
  matches: MatchMap,
  matchId: number,
): MatchMapEntry | undefined {
  return resolveBolaoMatchFromMap(matches, def.competitionId, matchId);
}
