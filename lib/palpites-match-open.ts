import {
  palpiteLockBeforeKickoffMs,
  type PredictionBolaoType,
} from "@/lib/palpites-kickoff-lock";

export type PalpiteMatchEligibilityInput = {
  status?: string | null;
  kickoffAt?: string | null;
  resultCasa?: number | null;
  resultVisitante?: number | null;
};

export type PalpiteRejectReason =
  | "open"
  | "finished"
  | "lock_window"
  | "match_started"
  | "live";

export function isFinishedMatchStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  return (
    s.includes("encerr") ||
    s.includes("finaliz") ||
    s.includes("cancel") ||
    s.includes("adiad") ||
    s.includes("suspens") ||
    s.includes("interromp")
  );
}

/** Partida em andamento (ao vivo, intervalo, etc.) — não aceita palpite. */
export function isLiveOrInProgressMatchStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  if (!s) return false;
  if (isFinishedMatchStatus(status)) return false;
  if (
    s.includes("agend") ||
    s.includes("program") ||
    s.includes("previst") ||
    s.includes("nao inici") ||
    s.includes("não inici") ||
    s.includes("not started") ||
    s === "aberto"
  ) {
    return false;
  }
  if (s.includes("vivo") || s.includes("live")) return true;
  if (s.includes("andament") || s.includes("em curso")) return true;
  if (s.includes("intervalo")) return true;
  if (s.includes("1º tempo") || s.includes("1o tempo")) return true;
  if (s.includes("2º tempo") || s.includes("2o tempo")) return true;
  return false;
}

export function isLockedByKickoff(
  kickoffAt: string | null | undefined,
  nowMs: number,
  bolaoType: PredictionBolaoType,
): boolean {
  if (!kickoffAt) return false;
  const kickoffMs = new Date(kickoffAt).getTime();
  if (!Number.isFinite(kickoffMs)) return false;
  const lead = palpiteLockBeforeKickoffMs(bolaoType);
  return nowMs >= kickoffMs - lead;
}

function kickoffMs(kickoffAt: string | null | undefined): number | null {
  if (!kickoffAt) return null;
  const ms = new Date(kickoffAt).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function isMatchStartedByKickoff(
  kickoffAt: string | null | undefined,
  nowMs: number,
): boolean {
  const ko = kickoffMs(kickoffAt);
  return ko != null && nowMs >= ko;
}

/** Placar oficial disponível (ignora 0×0 placeholder em partidas ainda não iniciadas). */
export function hasOfficialMatchResult(
  input: PalpiteMatchEligibilityInput,
  nowMs = Date.now(),
): boolean {
  if (input.resultCasa == null || input.resultVisitante == null) return false;
  const status = String(input.status ?? "");
  if (isFinishedMatchStatus(status) || isLiveOrInProgressMatchStatus(status)) {
    return true;
  }
  return isMatchStartedByKickoff(input.kickoffAt, nowMs);
}

export function resolveOfficialMatchResults(
  input: PalpiteMatchEligibilityInput,
  nowMs = Date.now(),
): { resultCasa: number | null; resultVisitante: number | null } {
  if (!hasOfficialMatchResult(input, nowMs)) {
    return { resultCasa: null, resultVisitante: null };
  }
  return {
    resultCasa: input.resultCasa ?? null,
    resultVisitante: input.resultVisitante ?? null,
  };
}

/** Motivo pelo qual o palpite não pode ser salvo (espelha POST /api/palpites). */
export function getPalpiteRejectReason(
  input: PalpiteMatchEligibilityInput,
  bolaoType: PredictionBolaoType,
  nowMs = Date.now(),
): PalpiteRejectReason {
  const status = String(input.status ?? "");
  if (isFinishedMatchStatus(status)) return "finished";
  if (hasOfficialMatchResult(input, nowMs)) return "finished";
  if (isLiveOrInProgressMatchStatus(status)) return "live";
  if (isMatchStartedByKickoff(input.kickoffAt, nowMs)) return "match_started";
  if (isLockedByKickoff(input.kickoffAt, nowMs, bolaoType)) return "lock_window";
  return "open";
}

export function palpiteRejectErrorMessage(
  reason: PalpiteRejectReason,
  bolaoType: PredictionBolaoType,
): string {
  switch (reason) {
    case "finished":
      return "Partida ja encerrada para palpites";
    case "lock_window":
      return bolaoType === "diario"
        ? "Palpite recusado: o prazo maximo e ate 1h antes do apito. Na ultima hora antes do jogo nao aceita nem primeiro palpite nem alteracao; quem nao registrou a tempo nao entra nesta partida."
        : "Palpite recusado: o prazo maximo e ate 5 minutos antes do apito. Apos esse limite nao aceita nem primeiro palpite nem alteracao.";
    case "live":
      return "Palpite recusado: partida em andamento. So e possivel palpitar ou alterar antes do apito.";
    case "match_started":
      return "Palpite recusado: partida ja iniciada. Nao e possivel registrar nem alterar palpite apos o apito.";
    default:
      return "Palpite recusado: partida indisponivel para palpites no momento.";
  }
}

/** Partida ainda aceita palpite (espelha validação do POST /api/palpites). */
export function isMatchOpenForPalpite(
  input: PalpiteMatchEligibilityInput,
  bolaoType: PredictionBolaoType,
  nowMs = Date.now(),
): boolean {
  return getPalpiteRejectReason(input, bolaoType, nowMs) === "open";
}

export function palpiteEligibilityFromJogo(jogo: {
  status: string;
  statusBruto?: string | null;
  kickoffAt?: string | null;
  resultCasa?: number | null;
  resultVisitante?: number | null;
}): PalpiteMatchEligibilityInput {
  return {
    status: String(jogo.statusBruto ?? jogo.status ?? ""),
    kickoffAt: jogo.kickoffAt,
    resultCasa: jogo.resultCasa,
    resultVisitante: jogo.resultVisitante,
  };
}
