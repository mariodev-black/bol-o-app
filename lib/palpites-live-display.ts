import {
  isPastMatchRegulationWindow,
  isWithinMatchRegulationWindow,
  matchRegulationMinutes,
  matchRegulationWindowMs,
} from "@/lib/football/match-regulation-window";
import {
  hasOfficialMatchResult,
  isFinishedMatchStatus,
  isLiveOrInProgressMatchStatus,
  palpiteEligibilityFromJogo,
  type PalpiteMatchEligibilityInput,
} from "@/lib/palpites-match-open";

export type LiveDisplayMatch = {
  status?: string | null;
  statusBruto?: string | null;
  kickoffAt?: string | null;
  resultCasa?: number | null;
  resultVisitante?: number | null;
};

export type JogoCardPhase = "pre" | "live" | "post";

export { matchRegulationMinutes, matchRegulationWindowMs };

export function displayLiveMaxMsAfterKickoff(): number {
  return matchRegulationWindowMs();
}

export function kickoffMsFromMatch(match: LiveDisplayMatch): number | null {
  if (!match.kickoffAt) return null;
  const t = new Date(match.kickoffAt).getTime();
  return Number.isFinite(t) ? t : null;
}

export function matchStatusRaw(match: LiveDisplayMatch): string {
  return String(match.statusBruto ?? match.status ?? "");
}

export function isPastDisplayLiveWindow(match: LiveDisplayMatch, nowMs: number): boolean {
  return isPastMatchRegulationWindow(match.kickoffAt, nowMs);
}

/**
 * Partida ao vivo na UI — somente dentro dos 90 min regulamentares após o apito.
 * Status da API só vale se ainda estiver na janela; após 90 min, deixa de ser ao vivo.
 */
export function isMatchLiveForDisplay(match: LiveDisplayMatch, nowMs = Date.now()): boolean {
  const raw = matchStatusRaw(match);
  const mapped = String(match.status ?? "").toLowerCase();

  if (mapped === "encerrado" || isFinishedMatchStatus(raw)) return false;

  const ko = kickoffMsFromMatch(match);
  if (ko == null || nowMs < ko) return false;
  if (!isWithinMatchRegulationWindow(match.kickoffAt, nowMs)) return false;

  if (isLiveOrInProgressMatchStatus(raw)) return true;

  return true;
}

export function getJogoCardPhase(match: LiveDisplayMatch, nowMs = Date.now()): JogoCardPhase {
  if (isMatchLiveForDisplay(match, nowMs)) return "live";

  const raw = matchStatusRaw(match);
  const encerrado =
    String(match.status ?? "").toLowerCase() === "encerrado" || isFinishedMatchStatus(raw);

  const eligibility: PalpiteMatchEligibilityInput = {
    status: raw,
    kickoffAt: match.kickoffAt,
    resultCasa: match.resultCasa,
    resultVisitante: match.resultVisitante,
  };

  if (encerrado && hasOfficialMatchResult(eligibility, nowMs)) return "post";

  if (hasOfficialMatchResult(eligibility, nowMs)) {
    if (isPastDisplayLiveWindow(match, nowMs) && !isLiveOrInProgressMatchStatus(raw)) {
      return "post";
    }
    if (encerrado) return "post";
  }

  if (encerrado || isPastDisplayLiveWindow(match, nowMs)) return "post";
  return "pre";
}

/** Alias para ranking/histórico — mesma regra dos cards de palpite. */
export function isRankingHistoricoLive(
  input: LiveDisplayMatch & { jogoData?: string; jogoHora?: string },
  nowMs = Date.now(),
): boolean {
  const kickoffAt =
    input.kickoffAt ??
    (input.jogoData && input.jogoHora
      ? parseKickoffFromBrDateHour(input.jogoData, input.jogoHora)
      : null);

  return isMatchLiveForDisplay(
    {
      status: input.status,
      statusBruto: input.statusBruto ?? input.status,
      kickoffAt,
      resultCasa: input.resultCasa,
      resultVisitante: input.resultVisitante,
    },
    nowMs,
  );
}

function parseKickoffFromBrDateHour(date: string, hour: string): string | null {
  const [d, m, y] = date.split("/");
  const hhmm = hour.slice(0, 5);
  if (!d || !m || !y || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${hhmm}:00-03:00`;
}

export function palpiteEligibilityFromLiveMatch(match: LiveDisplayMatch): PalpiteMatchEligibilityInput {
  return palpiteEligibilityFromJogo({
    status: String(match.status ?? ""),
    statusBruto: matchStatusRaw(match),
    kickoffAt: match.kickoffAt,
    resultCasa: match.resultCasa,
    resultVisitante: match.resultVisitante,
  });
}
