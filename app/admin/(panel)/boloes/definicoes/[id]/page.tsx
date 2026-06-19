import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { BolaoRankingPanel } from "@/app/admin/(panel)/boloes/_components/BolaoRankingPanel";
import { getAdminBolaoRankingPage } from "@/lib/admin/sections";
import type { BolaoDefinitionWithStats } from "@/lib/boloes/definitions/types";
import { getBolaoDefinitionById } from "@/lib/boloes/definitions/repository";
import { getBolaoDefinitionStats } from "@/lib/boloes/definitions/stats";
import { notFound } from "next/navigation";
import { AdminBolaoDefinitionDetailClient } from "./AdminBolaoDefinitionDetailClient";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminBolaoDefinitionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [definition, stats, ranking] = await Promise.all([
    getBolaoDefinitionById(id),
    getBolaoDefinitionStats(id),
    getAdminBolaoRankingPage({ type: "definition", id }).catch(() => ({
      rows: [],
      total: 0,
      summary: {
        ticketsCount: 0,
        playersCount: 0,
        totalPoints: 0,
        finishedCount: 0,
        promoTicketsCount: 0,
      },
    })),
  ]);

  if (!definition || !stats) notFound();

  const item: BolaoDefinitionWithStats = { ...definition, ...stats };

  return (
    <>
      <AdminPageTitle
        title={definition.displayName}
        subtitle="Métricas, ranking ao vivo e configuração."
      />
      <AdminBolaoDefinitionDetailClient id={id} item={item} />
      <section className="mt-8">
        <h2 className="mb-4 text-[14px] font-black uppercase tracking-[0.14em] text-white/40">
          Ranking deste bolão
        </h2>
        <BolaoRankingPanel
          scope={{ type: "definition", id }}
          initialRows={ranking.rows}
          total={ranking.total}
          emptyText="Quando houver cotas vendidas e palpites, o ranking aparece aqui."
        />
      </section>
    </>
  );
}
