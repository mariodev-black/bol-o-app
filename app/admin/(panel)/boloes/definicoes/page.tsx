import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { AdminBolaoDefinitionsClient } from "./AdminBolaoDefinitionsClient";

export default function AdminBolaoDefinitionsPage() {
  return (
    <>
      <AdminPageTitle
        title="Gerenciamento de bolões"
        subtitle="Crie, configure premiação, acompanhe vendas e publique na loja em tempo real."
      />
      <AdminBolaoDefinitionsClient />
    </>
  );
}
