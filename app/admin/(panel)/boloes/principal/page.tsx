import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { BolaoRankingTable } from "@/app/admin/(panel)/boloes/_components/BolaoRankingTable";
import { getAdminBoloesDashboardData } from "@/lib/admin/sections";
import Link from "next/link";

export default async function AdminBolaoPrincipalPage() {
  const data = await getAdminBoloesDashboardData();

  return (
    <>
      <div className="mb-5">
        <Link href="/admin/boloes" className="inline-flex rounded-full border border-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white/58 transition-colors hover:border-primary/25 hover:text-primary">
          Voltar para bolões
        </Link>
      </div>
      <AdminPageTitle
        title="Bolão principal"
        subtitle="Ranking detalhado do bolão principal, com usuários, posição, cota e pontuação."
      />
      <section className="overflow-hidden rounded-[18px] border border-white/8 bg-[#101010]">
        <div className="border-b border-white/8 px-5 py-4">
          <h2 className="text-[15px] font-black text-white">Ranking do bolão principal</h2>
          <p className="mt-1 text-[12px] font-medium text-white/38">
            {data.principal.ticketsCount} cotas · {data.principal.playersCount} jogadores · {data.principal.totalPoints} pontos
          </p>
        </div>
        <BolaoRankingTable rows={data.principal.ranking} emptyText="Nenhuma cota principal ranqueada" />
      </section>
    </>
  );
}
