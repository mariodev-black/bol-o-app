/** Final da Copa (Espanha x Argentina) — placar exato vale pontuação especial. */

const DEFAULT_COPA_FINAL_MATCH_ID = 32417;
const DEFAULT_COPA_FINAL_EXACT_POINTS = 10;
const DEFAULT_COPA_FINAL_GRACE_SECONDS = 90;

function envInt(name: string, fallback: number, min = 0): number {
  const raw = (process.env[name] ?? "").trim();
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

export function getCopaFinalMatchId(): number {
  return envInt("COPA_FINAL_MATCH_ID", DEFAULT_COPA_FINAL_MATCH_ID, 1);
}

export function getCopaFinalExactPoints(): number {
  return envInt("COPA_FINAL_EXACT_POINTS", DEFAULT_COPA_FINAL_EXACT_POINTS, 1);
}

/** Margem após o apito da final para fechar bolão geral / Skale e pagar prêmios. Default: 90s. */
export function getCopaFinalGraceAfterKickoffSeconds(): number {
  return envInt(
    "PRIZE_GENERAL_GRACE_AFTER_FINAL_SECONDS",
    DEFAULT_COPA_FINAL_GRACE_SECONDS,
  );
}

export function isCopaFinalMatch(matchId: number | null | undefined): boolean {
  if (matchId == null || !Number.isFinite(matchId)) return false;
  return Number(matchId) === getCopaFinalMatchId();
}

export const COPA_FINAL_BONUS_COPY =
  "Final da Copa: placar exato vale 10 pontos neste jogo.";
