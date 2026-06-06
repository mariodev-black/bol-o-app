import { getAppOrigin } from "@/lib/seo/config";

/** Link de campanha (redireciona para a home com o hub aberto). */
export const PROMOTIONS_HUB_PATH = "/promocoes";

/** Query na home que abre o bottom sheet de promoções. */
export const PROMOTIONS_HUB_QUERY_KEY = "promocoes";

type ReadonlyURLSearchParams = Pick<URLSearchParams, "get">;

export function isPromotionsHubOpenQuery(
  params: URLSearchParams | ReadonlyURLSearchParams,
): boolean {
  const v = params.get(PROMOTIONS_HUB_QUERY_KEY);
  return v === "1" || v === "true" || v === "open";
}

/** Path interno: home com hub aberto (sem rota dedicada). */
export function buildPromotionsHubHomePath(): string {
  return `/?${PROMOTIONS_HUB_QUERY_KEY}=1`;
}

export function buildPromotionsHubUrl(origin?: string): string {
  const base = (origin ?? getAppOrigin()).replace(/\/+$/, "");
  return `${base}${PROMOTIONS_HUB_PATH}`;
}

export type PromoHubCopyTemplate = {
  id: string;
  label: string;
  text: string;
};

export function buildPromoHubCopyTemplates(
  hubUrl: string,
): PromoHubCopyTemplate[] {
  return [
    {
      id: "short",
      label: "Curta (WhatsApp / SMS)",
      text: `🎁 Resgate suas cotas grátis no Bolão do Milhão: ${hubUrl}`,
    },
    {
      id: "cta",
      label: "Chamada para resgate",
      text: `Você tem brindes esperando! Entre em ${hubUrl}, faça login e toque em Resgatar brinde.`,
    },
    {
      id: "palpite",
      label: "Promo palpite Brasil x Egito",
      text: `Acerte o placar do amistoso Brasil x Egito e concorra a cota grátis + camisa oficial 👉 ${hubUrl}`,
    },
  ];
}
