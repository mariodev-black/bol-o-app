import type { StaticImageData } from "next/image";
import bgModalPromo from "@/app/assets/bg-modal-promo2.png";
import bannerPromoBrasilEgito from "@/app/assets/banner-promo-brasil-egito.png";
import type {
  PromoHubCategory,
  PromoHubItemId,
} from "@/lib/promotions/hub-shared";

export type PromoHubTabId = "all" | PromoHubCategory;

export const PROMO_HUB_TABS: readonly {
  id: PromoHubTabId;
  label: string;
}[] = [
  { id: "all", label: "Todas" },
  { id: "brindes", label: "Brindes" },
  { id: "palpite", label: "Palpites" },
];

export function promoHubCardImage(id: PromoHubItemId): StaticImageData {
  switch (id) {
    case "extra_gift":
      return bgModalPromo;
    case "brasil_egito_placar":
      return bannerPromoBrasilEgito;
    default:
      return bgModalPromo;
  }
}

export function promoHubTabLabel(id: PromoHubTabId): string {
  return PROMO_HUB_TABS.find((t) => t.id === id)?.label ?? "Todas";
}
