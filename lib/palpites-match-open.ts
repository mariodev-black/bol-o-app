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

/** Partida ainda aceita palpite (espelha validação do POST /api/palpites). */
export function isMatchOpenForPalpite(
  input: PalpiteMatchEligibilityInput,
  bolaoType: PredictionBolaoType,
  nowMs = Date.now(),
): boolean {
  const status = String(input.status ?? "");
  if (isFinishedMatchStatus(status)) return false;
  if (input.resultCasa != null && input.resultVisitante != null) return false;
  if (status !== "aberto") return false;
  if (isLockedByKickoff(input.kickoffAt, nowMs, bolaoType)) return false;
  if (input.kickoffAt) {
    const kickoffMs = new Date(input.kickoffAt).getTime();
    if (Number.isFinite(kickoffMs) && nowMs >= kickoffMs) return false;
  }
  return true;
}

export function palpiteEligibilityFromJogo(jogo: {
  status: string;
  kickoffAt?: string | null;
  resultCasa?: number | null;
  resultVisitante?: number | null;
}): PalpiteMatchEligibilityInput {
  return {
    status: jogo.status,
    kickoffAt: jogo.kickoffAt,
    resultCasa: jogo.resultCasa,
    resultVisitante: jogo.resultVisitante,
  };
}
