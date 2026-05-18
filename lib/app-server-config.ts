/**
 * Configuração lida no servidor (process.env) — mesma em dev, staging e produção.
 * Injetada no layout raiz para o client não depender só de fetch/local.
 */

import { parseExtraBolaoChampionshipIds } from "@/lib/boloes-extra-config";
import {
  getCopaBonusExtraPromoPublicConfig,
  type CopaBonusExtraPromoPublicConfig,
} from "@/lib/promotions/copa-bonus-extra";
import { getAppOrigin, getMarketingOrigin } from "@/lib/seo/config";

export type AppServerConfig = {
  /** Origem do app (`APP_URL`). */
  siteOrigin: string;
  appOrigin: string;
  marketingOrigin: string;
  subdomainRoutingEnabled: boolean;
  /** Requisição atual veio do host de marketing (www) — CTAs usam `appOrigin` no SSR. */
  isMarketingRequest: boolean;
  copaBonusPromo: CopaBonusExtraPromoPublicConfig;
  extraChampionshipIds: number[];
};

/** Snapshot de env para hidratar Providers e páginas (SSR/SSG em qualquer host). */
export function getAppServerConfig(): AppServerConfig {
  const appOrigin = getAppOrigin();
  return {
    siteOrigin: appOrigin,
    appOrigin,
    marketingOrigin: getMarketingOrigin(),
    subdomainRoutingEnabled: process.env.SUBDOMAIN_ROUTING_ENABLED === "true",
    isMarketingRequest: false,
    copaBonusPromo: getCopaBonusExtraPromoPublicConfig(),
    extraChampionshipIds: parseExtraBolaoChampionshipIds(),
  };
}
