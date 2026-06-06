import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { getAdminBrasilEgitoPromoDashboard } from "@/lib/admin/brasil-egito-placar-promo";
import { getAdminBrasilPanamaPromoDashboard } from "@/lib/admin/brasil-panama-placar-promo";
import { buildPromotionsHubUrl } from "@/lib/promotions/hub-public-links";
import { AdminPromocoesClient } from "./AdminPromocoesClient";

export default async function AdminPromocoesPage() {
  const [brasilEgito, brasilPanama] = await Promise.all([
    getAdminBrasilEgitoPromoDashboard(),
    getAdminBrasilPanamaPromoDashboard(),
  ]);

  const hubUrl = buildPromotionsHubUrl();

  return (
    <>
      <AdminPageTitle
        title="Promoções"
        subtitle="Palpites promocionais, acertos de placar, link de resgate e elegibilidade de prêmios."
      />
      <AdminPromocoesClient
        brasilEgito={brasilEgito}
        brasilPanama={brasilPanama}
        hubUrl={hubUrl}
      />
    </>
  );
}
