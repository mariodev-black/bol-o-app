import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { getAdminBrasilPanamaPromoDashboard } from "@/lib/admin/brasil-panama-placar-promo";
import { AdminPromocoesClient } from "./AdminPromocoesClient";

export default async function AdminPromocoesPage() {
  const data = await getAdminBrasilPanamaPromoDashboard();

  return (
    <>
      <AdminPageTitle
        title="Promoções"
        subtitle="Palpites promocionais, acertos de placar e elegibilidade de prêmios por indicações."
      />
      <AdminPromocoesClient data={data} />
    </>
  );
}
