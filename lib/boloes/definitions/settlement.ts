import type { BolaoDefinition } from "@/lib/boloes/definitions/types";
import { type MatchMapEntry } from "@/lib/football-api";

const LIVE_STATUSES = new Set([
  "em_andamento",
  "intervalo",
  "live",
  "ao_vivo",
  "primeiro_tempo",
  "segundo_tempo",
]);

const FINISHED_STATUSES = new Set([
  "finalizado",
  "encerrado",
  "finished",
  "match_finished",
]);

function parseKickoffMs(match: MatchMapEntry): number | null {
  if (match.kickoffAt) {
    const t = Date.parse(match.kickoffAt);
    if (Number.isFinite(t)) return t;
  }
  if (!match.dateBR) return null;
  const [d, m, y] = match.dateBR.split("/").map(Number);
  const [hh = 0, mm = 0] = (match.hour ?? "00:00").split(":").map(Number);
  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) return null;
  return new Date(y, m - 1, d, hh, mm).getTime();
}

export function isScopedMatchFinished(match: MatchMapEntry): boolean {
  const s = String(match.status ?? "").toLowerCase();
  if (FINISHED_STATUSES.has(s)) return true;
  if (match.resultCasa != null && match.resultVisitante != null) return true;
  return (
    s.includes("cancel") ||
    s.includes("adiad") ||
    s.includes("suspens") ||
    s.includes("interromp")
  );
}

export function isScopedMatchLive(match: MatchMapEntry): boolean {
  const s = String(match.status ?? "").toLowerCase();
  return LIVE_STATUSES.has(s);
}

function prizeDailyGraceAfterLastKickoffMinutes(): number {
  const n = Number.parseInt(
    (process.env.PRIZE_DAILY_GRACE_AFTER_LAST_KICKOFF_MINUTES || "180").trim(),
    10,
  );
  if (!Number.isFinite(n)) return 180;
  return Math.min(600, Math.max(0, n));
}

function prizeGeneralGraceHoursAfterLastKickoff(): number {
  const n = Number.parseFloat(
    (process.env.PRIZE_GENERAL_GRACE_HOURS_AFTER_LAST_KICKOFF || "36").trim(),
  );
  if (!Number.isFinite(n) || n <= 0) return 36;
  return Math.min(168, n);
}

function lastKickoffMs(matches: MatchMapEntry[]): number | null {
  let maxMs = 0;
  for (const m of matches) {
    const t = parseKickoffMs(m);
    if (t != null && t > maxMs) maxMs = t;
  }
  return maxMs > 0 ? maxMs : null;
}

function hasScheduledFutureKickoff(matches: MatchMapEntry[], nowMs: number): boolean {
  for (const m of matches) {
    const t = parseKickoffMs(m);
    if (t != null && t > nowMs) return true;
  }
  return false;
}

function usesDailySettlementGrace(def: BolaoDefinition): boolean {
  if (def.ticketType === "daily") return true;
  if (def.scopeMode === "daily_dates") return true;
  if (def.scopeMode === "round") return def.ticketType !== "general";
  return false;
}

/** Todos os jogos do escopo encerrados (placar ou status terminal). */
export function areAllScopedMatchesFinished(scoped: MatchMapEntry[]): boolean {
  return scoped.length > 0 && scoped.every(isScopedMatchFinished);
}

/** Pronto para apuração final / fechamento — inclui margem após último apito. */
export function isDefinitionReadyForSettlement(
  def: BolaoDefinition,
  scoped: MatchMapEntry[],
  nowMs = Date.now(),
): boolean {
  if (scoped.length === 0) return false;

  const settlementAt = def.settlementAt ? Date.parse(def.settlementAt) : null;
  if (settlementAt != null && Number.isFinite(settlementAt) && nowMs < settlementAt) {
    return false;
  }

  if (def.scopeMode === "full_competition" || def.ticketType === "general") {
    if (hasScheduledFutureKickoff(scoped, nowMs)) return false;
  }

  if (!areAllScopedMatchesFinished(scoped)) return false;

  const lastKo = lastKickoffMs(scoped);
  if (lastKo == null) return true;

  const graceMs = usesDailySettlementGrace(def)
    ? prizeDailyGraceAfterLastKickoffMinutes() * 60_000
    : prizeGeneralGraceHoursAfterLastKickoff() * 3600_000;

  return nowMs >= lastKo + graceMs;
}

/** Pode creditar prêmios (respeita prizeReleaseAt agendado). */
export function isDefinitionReadyForPrizeRelease(
  def: BolaoDefinition,
  nowMs = Date.now(),
): boolean {
  const releaseAt = def.prizeReleaseAt ? Date.parse(def.prizeReleaseAt) : null;
  if (releaseAt != null && Number.isFinite(releaseAt) && nowMs < releaseAt) {
    return false;
  }
  return true;
}
