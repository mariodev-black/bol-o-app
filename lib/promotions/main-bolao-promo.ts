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

/**
 * @deprecated Fechar o modal não persiste mais bloqueio — reabre em cada gatilho do fluxo.
 * Mantido só para não quebrar imports antigos.
 */
export function isMainBolaoPromoModalAlwaysVisible(): boolean {
  return true;
}
