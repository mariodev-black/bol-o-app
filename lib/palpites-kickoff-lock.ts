/**
 * Regras de fechamento de palpite antes do apito.
 * Módulo sem I/O (pode ser importado por Client Components).
 */

export type PredictionBolaoType = "principal" | "diario" | "extra";

/** Bolão do dia: até 1h antes do apito. */
export const PALPITE_LOCK_BEFORE_KICKOFF_MS_DIARIO = 60 * 60 * 1000;
/** Copa (principal), Skale e extras: apostar ou alterar até 5 minutos antes do apito. */
export const PALPITE_LOCK_BEFORE_KICKOFF_MS_COPA_POOL = 5 * 60 * 1000;

/** @deprecated Use PALPITE_LOCK_BEFORE_KICKOFF_MS_DIARIO */
export const PALPITE_LOCK_BEFORE_KICKOFF_MS_DEFAULT = PALPITE_LOCK_BEFORE_KICKOFF_MS_DIARIO;
/** @deprecated Use PALPITE_LOCK_BEFORE_KICKOFF_MS_COPA_POOL */
export const PALPITE_LOCK_BEFORE_KICKOFF_MS_EXTRA = PALPITE_LOCK_BEFORE_KICKOFF_MS_COPA_POOL;

export function palpiteUsesFiveMinuteLock(bolaoType: PredictionBolaoType): boolean {
  return bolaoType !== "diario";
}

export function palpiteLockBeforeKickoffMs(bolaoType: PredictionBolaoType): number {
  return palpiteUsesFiveMinuteLock(bolaoType)
    ? PALPITE_LOCK_BEFORE_KICKOFF_MS_COPA_POOL
    : PALPITE_LOCK_BEFORE_KICKOFF_MS_DIARIO;
}
