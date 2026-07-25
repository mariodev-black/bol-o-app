import type { BolaoDefinition, BolaoLifecycleStatus } from "@/lib/boloes/definitions/types";
import { LIFECYCLE_STATUS_LABELS } from "@/lib/boloes/definitions/lifecycle-labels";
import { getDailyEdition, isValidDailyEditionNumber } from "@/lib/boloes/daily-editions";
import { utcMsForBrDate } from "@/lib/diario-playable-date";
import { type MatchMap, type MatchMapEntry } from "@/lib/football-api";
import { scopeMatchesForBolaoDefinition } from "@/lib/boloes/definitions/scope";
import {
  areAllScopedMatchesFinished,
  isScopedMatchLive,
} from "@/lib/boloes/definitions/settlement";

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

function isMatchLive(match: MatchMapEntry): boolean {
  return isScopedMatchLive(match);
}

function isMatchFinished(match: MatchMapEntry): boolean {
  return areAllScopedMatchesFinished([match]);
}

function isMatchStarted(match: MatchMapEntry, nowMs: number): boolean {
  if (isMatchLive(match) || isMatchFinished(match)) return true;
  const kickoff = parseKickoffMs(match);
  return kickoff != null && kickoff <= nowMs;
}

function isBrDatePast(dateBR: string, nowMs: number): boolean {
  const dayMs = utcMsForBrDate(dateBR);
  if (dayMs == null) return false;
  return nowMs >= dayMs + 24 * 60 * 60 * 1000;
}

function resolveDailyEditionLifecycleFallback(
  editionNumber: number,
  nowMs: number,
): BolaoLifecycleStatus | null {
  if (!isValidDailyEditionNumber(editionNumber)) return "encerrado";
  const edition = getDailyEdition(editionNumber);
  if (!edition) return "encerrado";

  const lastDate = edition.datesBR[edition.datesBR.length - 1];
  if (lastDate && isBrDatePast(lastDate, nowMs)) return "encerrado";

  const firstDate = edition.datesBR[0];
  const firstMs = firstDate ? utcMsForBrDate(firstDate) : null;
  if (firstMs != null && nowMs < firstMs) return "programado";

  return null;
}

function resolveDailyDatesLifecycleFallback(
  def: BolaoDefinition,
  nowMs: number,
): BolaoLifecycleStatus | null {
  if (def.scopeMode !== "daily_dates") return null;

  if (def.editionNumber != null) {
    const byEdition = resolveDailyEditionLifecycleFallback(def.editionNumber, nowMs);
    if (byEdition) return byEdition;
  }

  if (def.scopeDates.length === 0) return null;

  const sorted = [...def.scopeDates].sort(
    (a, b) => (utcMsForBrDate(a) ?? 0) - (utcMsForBrDate(b) ?? 0),
  );
  const lastDate = sorted[sorted.length - 1];
  if (lastDate && isBrDatePast(lastDate, nowMs)) return "encerrado";

  const firstDate = sorted[0];
  const firstMs = firstDate ? utcMsForBrDate(firstDate) : null;
  if (firstMs != null && nowMs < firstMs) return "programado";

  return null;
}

export type BolaoLifecycleContext = {
  scopedMatches: MatchMapEntry[];
  nowMs?: number;
  prizesReleased?: boolean;
  rankingPublished?: boolean;
};

export function computeBolaoLifecycleStatus(
  def: BolaoDefinition,
  ctx: BolaoLifecycleContext,
): BolaoLifecycleStatus {
  const nowMs = ctx.nowMs ?? Date.now();
  const matches = ctx.scopedMatches;

  if (def.lifecycleStatus === "premiacao_liberada" || ctx.prizesReleased) {
    return "premiacao_liberada";
  }
  if (def.lifecycleStatus === "finalizado" && ctx.rankingPublished) {
    return "finalizado";
  }

  const startsAt = def.startsAt ? Date.parse(def.startsAt) : null;
  const endsAt = def.endsAt ? Date.parse(def.endsAt) : null;

  const anyStarted = matches.some((m) => isMatchStarted(m, nowMs));
  const allFinished = areAllScopedMatchesFinished(matches);
  const anyLive = matches.some((m) => isMatchLive(m));

  if (allFinished) {
    if (ctx.prizesReleased) return "premiacao_liberada";
    if (ctx.rankingPublished || def.lifecycleStatus === "finalizado") return "finalizado";
    return "encerrado";
  }

  if (anyLive || anyStarted) return "ao_vivo";

  if (startsAt != null && nowMs < startsAt) return "programado";
  if (endsAt != null && nowMs > endsAt) return "encerrado";

  if (matches.length === 0) {
    const dailyFallback = resolveDailyDatesLifecycleFallback(def, nowMs);
    if (dailyFallback) return dailyFallback;
  }

  if (def.saleEnabled && def.enabled) return "aberto";
  if (startsAt != null && nowMs >= startsAt) return "aberto";

  return def.lifecycleStatus === "programado" ? "programado" : "aberto";
}

export function buildLifecycleContext(
  def: BolaoDefinition,
  matches: MatchMap,
  extras?: Partial<BolaoLifecycleContext>,
): BolaoLifecycleContext {
  return {
    scopedMatches: scopeMatchesForBolaoDefinition(def, matches),
    nowMs: Date.now(),
    ...extras,
  };
}

export { LIFECYCLE_STATUS_LABELS } from "@/lib/boloes/definitions/lifecycle-labels";

export function isBolaoPurchaseOpen(
  def: BolaoDefinition,
  status: BolaoLifecycleStatus,
): boolean {
  return def.enabled && def.saleEnabled && (status === "aberto" || status === "programado");
}
