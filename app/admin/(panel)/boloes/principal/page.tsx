import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { BolaoDetailRankingSection } from "@/app/admin/(panel)/boloes/_components/BolaoDetailRankingSection";
import { AdminBolaoKindBadge, AdminBolaoKindIcon } from "@/app/admin/(panel)/boloes/_components/AdminBolaoKindIcon";
import { AdminBolaoStat } from "@/app/admin/(panel)/boloes/_components/AdminBolaoStat";
import { getAdminBolaoRankingPage } from "@/lib/admin/sections";
import { Gift, Target, Ticket, Users } from "lucide-react";
import Link from "next/link";

export default async function AdminBolaoPrincipalPage() {
  const scope = { type: "principal" as const };
  const ranking = await getAdminBolaoRankingPage(scope);
  const { summary } = ranking;

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
        title="Bolão principal"
        subtitle="Ranking do bolão principal — cotas pagas e grátis (prêmio / brinde)."
      />

      <div className="mb-5 flex flex-col gap-4 rounded-[18px] border border-white/8 bg-[#101010] p-5 sm:flex-row sm:items-center">
        <AdminBolaoKindIcon kind="principal" size="lg" />
        <div className="min-w-0 flex-1">
          <AdminBolaoKindBadge kind="principal" />
          <p className="mt-2 text-[22px] font-black text-white">FIFA World Cup</p>
          <p className="mt-1 text-[13px] font-medium text-white/45">Bolão principal — ranking geral</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:max-w-md sm:grid-cols-4">
          <AdminBolaoStat icon={Ticket} label="Cotas" value={summary.ticketsCount} accent="primary" />
          {summary.promoTicketsCount > 0 ? (
            <AdminBolaoStat icon={Gift} label="Grátis" value={summary.promoTicketsCount} accent="amber" />
          ) : null}
          <AdminBolaoStat icon={Users} label="Jogadores" value={summary.playersCount} />
          <AdminBolaoStat icon={Target} label="Pontos" value={summary.totalPoints} />
        </div>
      </div>

      <BolaoDetailRankingSection
        title="Ranking do bolão principal"
        description={`${summary.ticketsCount.toLocaleString("pt-BR")} cotas${summary.promoTicketsCount > 0 ? ` (${summary.promoTicketsCount.toLocaleString("pt-BR")} grátis)` : ""} · ${summary.playersCount.toLocaleString("pt-BR")} jogadores · ${summary.totalPoints.toLocaleString("pt-BR")} pontos`}
        scope={scope}
        initialRows={ranking.rows}
        total={ranking.total}
        emptyText="Nenhuma cota principal ranqueada"
      />
    </>
  );
}
