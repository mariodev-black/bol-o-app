import Link from "next/link";
import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { AdminArtilheirosClient } from "./AdminArtilheirosClient";

export default function AdminArtilheirosBolaoPage() {
  return (
    <>
      <div className="mb-5">
        <Link
          href="/admin/boloes"
          className="inline-flex rounded-full border border-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white/58 transition-colors hover:border-primary/25 hover:text-primary"
        >
          Voltar para bolões
        </Link>
      </div>
      <AdminPageTitle
        title="Bolão dos Artilheiros"
        subtitle="Defina o top 3 oficial, aplique o resultado e acompanhe o ranking das cotas."
      />
      <AdminArtilheirosClient />
    </>
  );
}
