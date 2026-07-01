import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { buildAdminBolaoHubItems } from "@/lib/admin/bolao-hub-items";
import { AdminBoloesHubClient } from "@/app/admin/(panel)/boloes/_components/AdminBoloesHubClient";

export default async function AdminBoloesPage() {
  const items = await buildAdminBolaoHubItems();

  return (
    <>
      <AdminPageTitle
        title="Bolões"
        subtitle="Catálogo, vendas e status — tudo centralizado."
      />
      <AdminBoloesHubClient initialItems={items} />
    </>
  );
}
