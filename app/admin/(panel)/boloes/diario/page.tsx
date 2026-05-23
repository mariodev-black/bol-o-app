import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { BolaoDetailRankingSection } from "@/app/admin/(panel)/boloes/_components/BolaoDetailRankingSection";
import { AdminBolaoKindBadge, AdminBolaoKindIcon } from "@/app/admin/(panel)/boloes/_components/AdminBolaoKindIcon";
import { AdminBolaoStat } from "@/app/admin/(panel)/boloes/_components/AdminBolaoStat";
import { getAdminBolaoRankingPage } from "@/lib/admin/sections";
import { Target, Ticket, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdminBolaoDiarioPage({
  searchParams,
}: {
  searchParams?: Promise<{ data?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const selectedDate = params?.data?.trim() ?? "";
  if (!selectedDate) notFound();

  const scope = { type: "daily" as const, date: selectedDate };
  const ranking = await getAdminBolaoRankingPage(scope);
  const { summary } = ranking;
  if (summary.ticketsCount === 0 && ranking.total === 0) notFound();

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
        title={`Bolão diário — ${selectedDate}`}
        subtitle="Ranking completo desta data com scroll infinito."
      />

      <div className="mb-5 flex flex-col gap-4 rounded-[18px] border border-white/8 bg-[#101010] p-5 sm:flex-row sm:items-center">
        <AdminBolaoKindIcon kind="daily" size="lg" />
        <div className="min-w-0 flex-1">
          <AdminBolaoKindBadge kind="daily" />
          <p className="mt-2 text-[22px] font-black text-white">{selectedDate}</p>
          <p className="mt-1 text-[13px] font-medium text-white/45">Bolão do dia</p>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 sm:max-w-sm">
          <AdminBolaoStat icon={Ticket} label="Cotas" value={summary.ticketsCount} accent="primary" />
          <AdminBolaoStat icon={Users} label="Jogadores" value={summary.playersCount} />
          <AdminBolaoStat icon={Target} label="Finalizadas" value={summary.finishedCount} />
        </div>
      </div>

      <BolaoDetailRankingSection
        title="Ranking do bolão diário"
        description={`${summary.ticketsCount.toLocaleString("pt-BR")} cotas · ${summary.playersCount.toLocaleString("pt-BR")} jogadores · ${summary.totalPoints.toLocaleString("pt-BR")} pontos`}
        scope={scope}
        initialRows={ranking.rows}
        total={ranking.total}
        emptyText="Nenhuma cota diária ranqueada"
      />
    </>
  );
}
