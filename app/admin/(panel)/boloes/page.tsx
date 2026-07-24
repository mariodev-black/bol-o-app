import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { buildAdminBolaoHubItems } from "@/lib/admin/bolao-hub-items";
import { AdminBoloesHubClient } from "@/app/admin/(panel)/boloes/_components/AdminBoloesHubClient";
import type { AdminBolaoHubItem } from "@/lib/boloes/definitions/types";

export default async function AdminBoloesPage() {
  let items: AdminBolaoHubItem[] = [];
  let loadError: string | null = null;

  try {
    items = await buildAdminBolaoHubItems();
  } catch (error) {
    console.error("[admin/boloes/page]", error);
    loadError =
      error instanceof Error
        ? error.message
        : "Não foi possível carregar os bolões. Tente recarregar a página.";
  }

  return (
    <>
      <AdminPageTitle
        title="Bolões"
        subtitle="Catálogo, vendas e status — tudo centralizado."
      />
      {loadError ? (
        <p className="mb-4 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-[13px] font-medium text-red-300">
          {loadError}
        </p>
      ) : null}
      <AdminBoloesHubClient initialItems={items} />
    </>
  );
}
