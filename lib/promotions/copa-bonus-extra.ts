/**
 * Promo: ao comprar ticket da Copa (bolão geral / principal), o usuário ganha
 * cotas extras do campeonato configurado (ex. Brasileirão — `BOLOES_EXTRA_CHAMPIONSHIP_IDS=10`).
 *
 * `COPA_BONUS_EXTRA_PROMO_ENABLED=true` liga modal pós-login e crédito automático no checkout.
 */

import {
  extraBolaoFallbackDisplayName,
  isBrasileiraoExtraChampionship,
} from "@/lib/boloes-extra-competition-branding";
import { parseExtraBolaoChampionshipIds } from "@/lib/boloes-extra-config";

function env(name: string): string {
  const raw = process.env[name];
  return raw == null ? "" : String(raw).trim();
}

function envBool(name: string): boolean {
  const s = env(name).toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

/** Liga modal pós-auth e inclusão automática de extras grátis no carrinho. */
export function isCopaBonusExtraPromoEnabled(): boolean {
  return envBool("COPA_BONUS_EXTRA_PROMO_ENABLED");
}

/** ID do campeonato extra concedido como bônus (default: primeiro Brasileirão em BOLOES_EXTRA_* ou primeiro da lista). */
export function getCopaBonusExtraChampionshipId(): number | null {
  if (!isCopaBonusExtraPromoEnabled()) return null;

  const explicit = env("COPA_BONUS_EXTRA_PROMO_CHAMPIONSHIP_ID");
  if (explicit) {
    const id = Number.parseInt(explicit, 10);
    if (Number.isFinite(id) && id > 0 && parseExtraBolaoChampionshipIds().includes(id)) {
      return id;
    }
  }

  const extras = parseExtraBolaoChampionshipIds();
  if (extras.length === 0) return null;

  const brasileirao = extras.find((id) => isBrasileiraoExtraChampionship(id, null));
  return brasileirao ?? extras[0] ?? null;
}

/** Uma cota extra grátis por cada ticket geral (Copa) no carrinho. */
export function copaBonusExtraQuantityForGeneralTickets(generalQty: number): number {
  if (!isCopaBonusExtraPromoEnabled()) return 0;
  if (getCopaBonusExtraChampionshipId() == null) return 0;
  return Math.max(0, Math.min(20, Math.trunc(generalQty)));
}

export type CopaBonusExtraPromoPublicConfig = {
  enabled: boolean;
  championshipId: number | null;
  bonusExtraDisplayName: string;
  /** Rótulo do produto principal (Copa). */
  principalProductLabel: string;
  /** Texto curto para badges (ex. "Brasileirão"). */
  bonusShortLabel: string;
};

export function getCopaBonusExtraPromoPublicConfig(): CopaBonusExtraPromoPublicConfig {
  const enabled = isCopaBonusExtraPromoEnabled();
  const championshipId = enabled ? getCopaBonusExtraChampionshipId() : null;
  const bonusExtraDisplayName =
    championshipId != null ? extraBolaoFallbackDisplayName(championshipId) : "Bolão extra";
  const principalProductLabel =
    env("COPA_BONUS_EXTRA_PROMO_PRINCIPAL_LABEL").trim() || "Bolão do Milhão 2026";
  const bonusShortLabel =
    env("COPA_BONUS_EXTRA_PROMO_BONUS_LABEL").trim() || bonusExtraDisplayName;

  return {
    enabled: enabled && championshipId != null,
    championshipId,
    bonusExtraDisplayName,
    principalProductLabel,
    bonusShortLabel,
  };
}
