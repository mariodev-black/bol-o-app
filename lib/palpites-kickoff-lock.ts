/**
 * Regras de fechamento de palpite antes do apito.
 * Módulo sem I/O (pode ser importado por Client Components).
 */

export type PredictionBolaoType = "principal" | "diario" | "extra";

/** Todos os bolões: apostar ou alterar até 5 segundos antes do apito. */
export const PALPITE_LOCK_BEFORE_KICKOFF_MS = 5_000;

/** @deprecated Use PALPITE_LOCK_BEFORE_KICKOFF_MS */
export const PALPITE_LOCK_BEFORE_KICKOFF_MS_DIARIO = PALPITE_LOCK_BEFORE_KICKOFF_MS;
/** @deprecated Use PALPITE_LOCK_BEFORE_KICKOFF_MS */
export const PALPITE_LOCK_BEFORE_KICKOFF_MS_COPA_POOL = PALPITE_LOCK_BEFORE_KICKOFF_MS;
/** @deprecated Use PALPITE_LOCK_BEFORE_KICKOFF_MS */
export const PALPITE_LOCK_BEFORE_KICKOFF_MS_DEFAULT = PALPITE_LOCK_BEFORE_KICKOFF_MS;
/** @deprecated Use PALPITE_LOCK_BEFORE_KICKOFF_MS */
export const PALPITE_LOCK_BEFORE_KICKOFF_MS_EXTRA = PALPITE_LOCK_BEFORE_KICKOFF_MS;

export function palpiteLockBeforeKickoffMs(
  _bolaoType?: PredictionBolaoType,
): number {
  return PALPITE_LOCK_BEFORE_KICKOFF_MS;
}
