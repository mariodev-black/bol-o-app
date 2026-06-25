import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { AdminBannersClient } from "./AdminBannersClient";

export default function AdminBannersPage() {
  return (
    <>
      <AdminPageTitle
        title="Banners da home"
        subtitle="Gerencie os banners do carrossel principal e os cards de Próximos Bolões. Enquanto não houver itens cadastrados, a home exibe o conteúdo padrão."
      />
      <AdminBannersClient />
    </>
  );
}
