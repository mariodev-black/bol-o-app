import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { getAdminBrasilEgitoPromoDashboard } from "@/lib/admin/brasil-egito-placar-promo";
import { getAdminBrasilPanamaPromoDashboard } from "@/lib/admin/brasil-panama-placar-promo";
import { AdminPromocoesClient } from "./AdminPromocoesClient";

export default async function AdminPromocoesPage() {
  const [brasilEgito, brasilPanama] = await Promise.all([
    getAdminBrasilEgitoPromoDashboard(),
    getAdminBrasilPanamaPromoDashboard(),
  ]);

  return (
    <>
      <AdminPageTitle
        title="Promoções"
        subtitle="Palpites promocionais, acertos de placar e elegibilidade de prêmios por indicações."
      />
      <AdminPromocoesClient brasilEgito={brasilEgito} brasilPanama={brasilPanama} />
    </>
  );
}
