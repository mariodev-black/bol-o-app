import type {
  BolaoCompetitionScopeRule,
  BolaoDefinition,
} from "@/lib/boloes/definitions/types";
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

function matchesForCompetition(
  matches: MatchMap,
  competitionId: number,
  def: BolaoDefinition,
): MatchMapEntry[] {
  const comp = competitionId;
  if (isSkaleBolaoCompetition(comp) || def.scopeMode === "daily_dates") {
    return skaleScopeMatchesFromMap(matches, comp);
  }
  return Array.from(matches.values()).filter(
    (m) => (Number(m.competitionId) || comp) === comp,
  );
}

function applyLegacyScopeMode(
  def: BolaoDefinition,
  list: MatchMapEntry[],
): MatchMapEntry[] {
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
    case "custom_matches": {
      const ids = new Set(def.scopeMatchIds);
      if (ids.size === 0) return [];
      return list.filter((m) => ids.has(m.id));
    }
    case "full_competition":
    default:
      return list;
  }
}

function applyCompetitionRule(
  matches: MatchMap,
  rule: BolaoCompetitionScopeRule,
): MatchMapEntry[] {
  const list = matchesForCompetition(matches, rule.competitionId, {
    competitionId: rule.competitionId,
    scopeMode: rule.mode === "all_matches" ? "full_competition" : rule.mode,
  } as BolaoDefinition);

  if (rule.matchIds?.length) {
    const ids = new Set(rule.matchIds);
    return list.filter((m) => ids.has(m.id));
  }

  if (rule.mode === "daily_dates" && rule.scopeDates?.length) {
    const dateSet = new Set(rule.scopeDates);
    return list.filter((m) => m.dateBR != null && dateSet.has(m.dateBR));
  }

  if (rule.mode === "round" && rule.roundNumber != null) {
    return list.filter((m) => Number(m.rodada) === rule.roundNumber);
  }

  if (rule.mode === "weekend") {
    return list.filter((m) => m.dateBR != null && isWeekendDate(m.dateBR));
  }

  return list;
}

function dedupeMatches(entries: MatchMapEntry[]): MatchMapEntry[] {
  const seen = new Set<number>();
  const out: MatchMapEntry[] = [];
  for (const m of entries) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

/** Partidas válidas para palpites conforme definição admin. */
export function scopeMatchesForBolaoDefinition(
  def: BolaoDefinition,
  matches: MatchMap,
): MatchMapEntry[] {
  if (def.scopeMode === "multi_competition" && def.scopeConfig.competitions.length > 0) {
    const merged: MatchMapEntry[] = [];
    for (const rule of def.scopeConfig.competitions) {
      merged.push(...applyCompetitionRule(matches, rule));
    }
    return dedupeMatches(merged);
  }

  if (def.scopeMode === "custom_matches") {
    const ids = new Set(def.scopeMatchIds);
    if (def.scopeConfig.competitions.length > 0) {
      for (const rule of def.scopeConfig.competitions) {
        for (const id of rule.matchIds ?? []) ids.add(id);
      }
    }
    if (ids.size === 0) return [];
    return Array.from(matches.values()).filter((m) => ids.has(m.id));
  }

  const competitionIds =
    def.competitionIds.length > 0 ? def.competitionIds : [def.competitionId];

  if (competitionIds.length > 1) {
    const merged: MatchMapEntry[] = [];
    for (const compId of competitionIds) {
      const list = matchesForCompetition(matches, compId, def);
      merged.push(...applyLegacyScopeMode({ ...def, competitionId: compId }, list));
    }
    return dedupeMatches(merged);
  }

  const comp = def.competitionId;
  const list = matchesForCompetition(matches, comp, def);
  return applyLegacyScopeMode(def, list);
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
  const scoped = scopeMatchesForBolaoDefinition(def, matches);
  const hit = scoped.find((m) => m.id === matchId);
  if (hit) return hit;
  return resolveBolaoMatchFromMap(matches, def.competitionId, matchId);
}
