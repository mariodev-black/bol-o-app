import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { BolaoDetailRankingSection } from "@/app/admin/(panel)/boloes/_components/BolaoDetailRankingSection";
import { AdminBolaoKindBadge, AdminBolaoKindIcon } from "@/app/admin/(panel)/boloes/_components/AdminBolaoKindIcon";
import { AdminBolaoStat } from "@/app/admin/(panel)/boloes/_components/AdminBolaoStat";
import { formatAdminRodadaLabel } from "@/lib/admin/format";
import {
  extraBolaoFallbackDisplayName,
  getExtraBolaoHeroSideVariant,
} from "@/lib/boloes-extra-competition-branding";
import { readCompetitionDisplayNamesFromDb } from "@/lib/competition-metadata-cache";
import { getAdminBolaoRankingPage, parseExtraBolaoScopeKey } from "@/lib/admin/sections";
import { Gift, Target, Ticket, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdminBolaoExtraPage({
  searchParams,
}: {
  searchParams?: Promise<{ key?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const selectedKey = params?.key?.trim() ?? "";
  const parsed = parseExtraBolaoScopeKey(selectedKey);
  if (!parsed) notFound();

  const labels = await readCompetitionDisplayNamesFromDb([parsed.championshipId]).catch(
    () => ({} as Record<number, string>),
  );
  const displayName =
    labels[parsed.championshipId] ?? extraBolaoFallbackDisplayName(parsed.championshipId);
  const iconVariant = getExtraBolaoHeroSideVariant(parsed.championshipId, displayName);

  const scope = { type: "extra" as const, key: selectedKey };
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
        title={`${formatAdminRodadaLabel(parsed.rodada)} — ${displayName}`}
        subtitle="Ranking completo desta rodada com scroll infinito."
      />

      <div className="mb-5 flex flex-col gap-4 rounded-[18px] border border-white/8 bg-[#101010] p-5 sm:flex-row sm:items-center">
        <AdminBolaoKindIcon kind="extra" extraVariant={iconVariant} size="lg" />
        <div className="min-w-0 flex-1">
          <AdminBolaoKindBadge kind="extra" />
          <p className="mt-2 text-[22px] font-black text-white">
            {formatAdminRodadaLabel(parsed.rodada)}
          </p>
          <p className="mt-1 text-[13px] font-medium text-white/45">{displayName}</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:max-w-md sm:grid-cols-4">
          <AdminBolaoStat icon={Ticket} label="Cotas" value={summary.ticketsCount} accent="primary" />
          <AdminBolaoStat icon={Users} label="Jogadores" value={summary.playersCount} />
          <AdminBolaoStat icon={Target} label="Finalizadas" value={summary.finishedCount} />
          <AdminBolaoStat icon={Gift} label="Grátis" value={summary.promoTicketsCount} accent="amber" />
        </div>
      </div>

      <BolaoDetailRankingSection
        title="Ranking da rodada"
        description={`${summary.ticketsCount.toLocaleString("pt-BR")} cotas · ${summary.playersCount.toLocaleString("pt-BR")} jogadores · ${summary.totalPoints.toLocaleString("pt-BR")} pontos`}
        scope={scope}
        initialRows={ranking.rows}
        total={ranking.total}
        emptyText="Nenhuma cota extra nesta rodada"
      />
    </>
  );
}
