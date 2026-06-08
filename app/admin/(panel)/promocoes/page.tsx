import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { getAdminBrasilMarrocosPromoDashboard } from "@/lib/admin/brasil-marrocos-placar-promo";
import { getAdminBrasilPanamaPromoDashboard } from "@/lib/admin/brasil-panama-placar-promo";
import { buildPromotionsHubUrl } from "@/lib/promotions/hub-public-links";
import { AdminPromocoesClient } from "./AdminPromocoesClient";

export default async function AdminPromocoesPage() {
  const [brasilMarrocos, brasilPanama] = await Promise.all([
    getAdminBrasilMarrocosPromoDashboard(),
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
        brasilMarrocos={brasilMarrocos}
        brasilPanama={brasilPanama}
        hubUrl={hubUrl}
      />
    </>
  );
}
