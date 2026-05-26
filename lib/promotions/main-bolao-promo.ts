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
  return envBool(
    "NEXT_PUBLIC_MAIN_BOLAO_PROMO_MODAL_ENABLED",
    process.env.NODE_ENV === "development",
  );
}

/** Em dev: reabre a cada visita; em prod: pode persistir dismiss (futuro). */
export function isMainBolaoPromoModalAlwaysVisible(): boolean {
  return envBool(
    "NEXT_PUBLIC_MAIN_BOLAO_PROMO_MODAL_ALWAYS",
    process.env.NODE_ENV === "development",
  );
}
