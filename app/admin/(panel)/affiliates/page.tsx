import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { getAdminAffiliateDashboardData } from "@/lib/admin/sections";
import { AdminAffiliatesClient } from "./AdminAffiliatesClient";

export default async function AdminAffiliatesPage() {
  const data = await getAdminAffiliateDashboardData();

  return (
    <>
      <AdminPageTitle title="Afiliados" subtitle="Acompanhe afiliados, usuários indicados, comissões e saques." />
      <AdminAffiliatesClient data={data} />
    </>
  );
}
