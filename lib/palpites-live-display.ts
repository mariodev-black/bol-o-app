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

export function displayLiveMaxMsAfterKickoff(): number {
  const raw = process.env.NEXT_PUBLIC_MATCH_DISPLAY_LIVE_MAX_MINUTES;
  const n =
    raw != null && String(raw).trim() !== ""
      ? Number.parseInt(String(raw).trim(), 10)
      : 115;
  if (!Number.isFinite(n)) return 115 * 60_000;
  return Math.min(240, Math.max(60, n)) * 60_000;
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
  const ko = kickoffMsFromMatch(match);
  if (ko == null) return false;
  return nowMs > ko + displayLiveMaxMsAfterKickoff();
}

/**
 * Partida ao vivo na UI — alinhado ao fluxo antigo:
 * 1) status da API (andamento, intervalo, …) manda, sem teto de 115 min;
 * 2) fallback por apito + janela quando a listagem não traz status ao vivo.
 */
export function isMatchLiveForDisplay(match: LiveDisplayMatch, nowMs = Date.now()): boolean {
  const raw = matchStatusRaw(match);
  const mapped = String(match.status ?? "").toLowerCase();

  if (mapped === "encerrado" || isFinishedMatchStatus(raw)) return false;
  if (isLiveOrInProgressMatchStatus(raw)) return true;

  const ko = kickoffMsFromMatch(match);
  if (ko == null || nowMs < ko) return false;
  if (isPastDisplayLiveWindow(match, nowMs)) return false;
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

  if (encerrado) return "post";
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
