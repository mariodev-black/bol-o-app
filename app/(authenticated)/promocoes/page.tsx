import { redirect } from "next/navigation";
import { buildPromotionsHubHomePath } from "@/lib/promotions/hub-public-links";

/** Campanha `/promocoes` → home normal com hub de promoções aberto. */
export default function PromocoesPage() {
  redirect(buildPromotionsHubHomePath());
}
