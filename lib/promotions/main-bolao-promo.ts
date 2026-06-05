/**
 * Modal promocional do bolão principal (cota geral).
 * Controle via `NEXT_PUBLIC_MAIN_BOLAO_PROMO_MODAL_ENABLED` (default: ativo em dev).
 *
 * Exibição (via `requestModal` em `MainBolaoPromoModalHost`):
 * navega na hora → modal ~1s depois na página de destino.
 * - /boloes — card do bolão extra grátis: "Fazer palpites" ou "Ver classificação"
 * - /palpites — aba/link Ranking; ao salvar todos os palpites da rodada
 */

function envBool(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw === "") return defaultValue;
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return defaultValue;
}

/** Exibir modal (client-safe — prefixo NEXT_PUBLIC_). */
export function isMainBolaoPromoModalEnabled(): boolean {
  return envBool("NEXT_PUBLIC_MAIN_BOLAO_PROMO_MODAL_ENABLED", true);
}

const MAIN_BOLAO_PROMO_DISMISSED_PREFIX = "bolao_main_promo_modal_dismissed";

export function mainBolaoPromoDismissStorageKey(
  userId?: string | null,
): string {
  const id = userId?.trim();
  return id
    ? `${MAIN_BOLAO_PROMO_DISMISSED_PREFIX}_${id}`
    : MAIN_BOLAO_PROMO_DISMISSED_PREFIX;
}

/** Modal já exibido/fechado no fluxo promo (ex.: pós-indicação Brasil x Egito). */
export function readMainBolaoPromoModalDismissed(
  userId?: string | null,
): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      localStorage.getItem(mainBolaoPromoDismissStorageKey(userId)) === "1"
    );
  } catch {
    return false;
  }
}

export function persistMainBolaoPromoModalDismissed(
  userId?: string | null,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(mainBolaoPromoDismissStorageKey(userId), "1");
  } catch {
    /* quota / private mode */
  }
}

/**
 * @deprecated Fechar o modal não persiste mais bloqueio — reabre em cada gatilho do fluxo.
 * Mantido só para não quebrar imports antigos.
 */
export function isMainBolaoPromoModalAlwaysVisible(): boolean {
  return true;
}
