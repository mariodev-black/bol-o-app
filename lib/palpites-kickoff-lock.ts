/**
 * Regras de fechamento de palpite antes do apito.
 * Módulo sem I/O (pode ser importado por Client Components).
 */

export type PredictionBolaoType = "principal" | "diario" | "extra";

/** Bolão geral e bolão do dia: até 1h antes do apito. */
export const PALPITE_LOCK_BEFORE_KICKOFF_MS_DEFAULT = 60 * 60 * 1000;
/** Bolão extra: apostar ou alterar até 5 minutos antes do apito. */
export const PALPITE_LOCK_BEFORE_KICKOFF_MS_EXTRA = 5 * 60 * 1000;

export function palpiteLockBeforeKickoffMs(bolaoType: PredictionBolaoType): number {
  return bolaoType === "extra" ? PALPITE_LOCK_BEFORE_KICKOFF_MS_EXTRA : PALPITE_LOCK_BEFORE_KICKOFF_MS_DEFAULT;
}
