import "server-only";

import { utcMsForBrDate } from "@/lib/diario-playable-date";
import { getMatchFromMap, type MatchMap, type MatchMapEntry } from "@/lib/football-api";
import { hasOfficialMatchResult } from "@/lib/palpites-match-open";
import { palpiteLockBeforeKickoffMs } from "@/lib/palpites-kickoff-lock";
import {
  type DailyEdition,
  type DailyEditionStatus,
  getDailyEdition,
  inferDailyEditionFromDates,
} from "@/lib/boloes/daily-editions";

function isMatchFinishedForEdition(
  m: Pick<MatchMapEntry, "status" | "kickoffAt" | "resultCasa" | "resultVisitante">,
): boolean {
  const st = String(m.status || "").toLowerCase();
  if (
    st.includes("encerr") ||
    st.includes("finaliz") ||
    st.includes("cancel") ||
    st.includes("adiad") ||
    st.includes("suspens") ||
    st.includes("interromp")
  ) {
    return true;
  }
  return hasOfficialMatchResult({
    status: m.status,
    kickoffAt: m.kickoffAt,
    resultCasa: m.resultCasa,
    resultVisitante: m.resultVisitante,
  });
}

function matchesForEdition(
  edition: DailyEdition,
  matchMap: MatchMap,
  mainComp: number,
): MatchMapEntry[] {
  const dateSet = new Set(edition.datesBR);
  const out: MatchMapEntry[] = [];
  for (const m of matchMap.values()) {
    if ((Number(m.competitionId) || mainComp) !== mainComp) continue;
    if (m.dateBR && dateSet.has(m.dateBR)) out.push(m);
  }
  return out;
}

/** Edição encerrada: todos os jogos do intervalo já passaram do prazo de palpite. */
export function isDailyEditionClosed(
  editionNumber: number,
  matchMap: MatchMap,
  mainComp: number,
  nowMs: number = Date.now(),
): boolean {
  const edition = getDailyEdition(editionNumber);
  if (!edition) return true;
  const lockLead = palpiteLockBeforeKickoffMs("diario");
  const scoped = matchesForEdition(edition, matchMap, mainComp);

  if (scoped.length === 0) {
    const lastDate = edition.datesBR[edition.datesBR.length - 1]!;
    const lastMs = utcMsForBrDate(lastDate);
    if (lastMs == null) return false;
    const endOfDayMs = lastMs + 24 * 60 * 60 * 1000;
    return nowMs >= endOfDayMs;
  }

  let hasOpen = false;
  for (const m of scoped) {
    if (isMatchFinishedForEdition(m)) continue;
    const ko = m.kickoffAt ? new Date(m.kickoffAt).getTime() : null;
    const locked = ko != null && Number.isFinite(ko) && nowMs >= ko - lockLead;
    if (!locked) {
      hasOpen = true;
      break;
    }
  }
  return !hasOpen;
}

export function resolveDailyEditionStatus(
  editionNumber: number,
  matchMap: MatchMap,
  mainComp: number,
  nowMs: number = Date.now(),
): DailyEditionStatus {
  const edition = getDailyEdition(editionNumber);
  if (!edition) return "encerrado";

  if (isDailyEditionClosed(editionNumber, matchMap, mainComp, nowMs)) {
    return "encerrado";
  }

  const firstDate = edition.datesBR[0]!;
  const firstMs = utcMsForBrDate(firstDate);
  const todayMs = utcMsForBrDate(
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(nowMs)),
  );
  if (firstMs != null && todayMs != null && todayMs < firstMs) {
    return "em_breve";
  }

  return "aberto";
}

export function isDailyEditionPurchaseOpen(
  editionNumber: number,
  matchMap: MatchMap,
  mainComp: number,
  nowMs?: number,
): boolean {
  return !isDailyEditionClosed(editionNumber, matchMap, mainComp, nowMs);
}

export function inferDailyEditionFromMatchIds(
  matchIds: Iterable<number>,
  matchMap: MatchMap,
  mainComp: number,
): number | null {
  const dates: string[] = [];
  for (const rawId of matchIds) {
    const m = getMatchFromMap(matchMap, mainComp, Number(rawId));
    if (m?.dateBR) dates.push(m.dateBR);
  }
  return inferDailyEditionFromDates(dates);
}
