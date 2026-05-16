/**
 * Configuração lida no servidor (process.env) — mesma em dev, staging e produção.
 * Injetada no layout raiz para o client não depender só de fetch/local.
 */

import { parseExtraBolaoChampionshipIds } from "@/lib/boloes-extra-config";
import {
  getCopaBonusExtraPromoPublicConfig,
  type CopaBonusExtraPromoPublicConfig,
} from "@/lib/promotions/copa-bonus-extra";

export type AppServerConfig = {
  /** Origem pública do site (`APP_URL` sem barra final). */
  siteOrigin: string;
  copaBonusPromo: CopaBonusExtraPromoPublicConfig;
  extraChampionshipIds: number[];
};

function resolveSiteOrigin(): string {
  const raw = (process.env.APP_URL || "https://bolaodomilhao.com.br").trim();
  if (!raw) return "https://bolaodomilhao.com.br";
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return u.origin;
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

/** Snapshot de env para hidratar Providers e páginas (SSR/SSG em qualquer host). */
export function getAppServerConfig(): AppServerConfig {
  return {
    siteOrigin: resolveSiteOrigin(),
    copaBonusPromo: getCopaBonusExtraPromoPublicConfig(),
    extraChampionshipIds: parseExtraBolaoChampionshipIds(),
  };
}
