import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { BolaoRankingTable } from "@/app/admin/(panel)/boloes/_components/BolaoRankingTable";
import { AdminBolaoKindBadge, AdminBolaoKindIcon } from "@/app/admin/(panel)/boloes/_components/AdminBolaoKindIcon";
import { AdminBolaoStat } from "@/app/admin/(panel)/boloes/_components/AdminBolaoStat";
import { getAdminBoloesDashboardData } from "@/lib/admin/sections";
import { Gift, Target, Ticket, Users } from "lucide-react";
import Link from "next/link";

export default async function AdminBolaoExtraPage({
  searchParams,
}: {
  searchParams?: Promise<{ key?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const selectedKey = params?.key ?? null;
  const data = await getAdminBoloesDashboardData(null, selectedKey);
  const card = data.selectedExtraCard;

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
        title={card ? `Bolão extra — ${card.displayName}` : "Bolão extra"}
        subtitle={
          card
            ? `Jogos em ${card.date} · ranking detalhado deste campeonato.`
            : "Nenhum bolão extra encontrado."
        }
      />

      {card ? (
        <div className="mb-5 flex flex-col gap-4 rounded-[18px] border border-white/8 bg-[#101010] p-5 sm:flex-row sm:items-center">
          <AdminBolaoKindIcon kind="extra" extraVariant={card.iconVariant} size="lg" />
          <div className="min-w-0 flex-1">
            <AdminBolaoKindBadge kind="extra" />
            <p className="mt-2 text-[22px] font-black text-white">{card.displayName}</p>
            <p className="mt-1 text-[13px] font-medium text-white/45">{card.date}</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:max-w-md sm:grid-cols-4">
            <AdminBolaoStat icon={Ticket} label="Cotas" value={card.ticketsCount} accent="primary" />
            <AdminBolaoStat icon={Users} label="Jogadores" value={card.playersCount} />
            <AdminBolaoStat icon={Target} label="Finalizadas" value={card.finishedCount} />
            <AdminBolaoStat icon={Gift} label="Grátis" value={card.promoTicketsCount} accent="amber" />
          </div>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[18px] border border-white/8 bg-[#101010]">
        <div className="border-b border-white/8 px-5 py-4">
          <h2 className="text-[15px] font-black text-white">Ranking do bolão extra</h2>
          <p className="mt-1 text-[12px] font-medium text-white/38">
            {card
              ? `${card.ticketsCount} cotas · ${card.playersCount} jogadores · ${card.promoTicketsCount} grátis · ${card.totalPoints} pontos`
              : "Sem dados para este bolão."}
          </p>
        </div>
        <BolaoRankingTable rows={data.selectedExtraRanking} emptyText="Nenhuma cota extra ranqueada" />
      </section>
    </>
  );
}
