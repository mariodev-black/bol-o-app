import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { AdminBolaoDashboardCard } from "@/app/admin/(panel)/boloes/_components/AdminBolaoDashboardCard";
import { AdminExtraCompetitionSection } from "@/app/admin/(panel)/boloes/_components/AdminExtraCompetitionSection";
import { getAdminBoloesDashboardData, type AdminExtraBolaoCard } from "@/lib/admin/sections";
import { Gift, Layers, Ticket, Trophy, Users } from "lucide-react";
import Link from "next/link";

function groupExtraCardsByCompetition(cards: AdminExtraBolaoCard[]) {
  const map = new Map<string, AdminExtraBolaoCard[]>();
  for (const card of cards) {
    const list = map.get(card.displayName) ?? [];
    list.push(card);
    map.set(card.displayName, list);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
}

export default async function AdminBoloesPage() {
  const data = await getAdminBoloesDashboardData();
  const extraByCompetition = groupExtraCardsByCompetition(data.extraCards);

  const totalPaidTickets =
    data.principal.ticketsCount +
    data.dailyCards.reduce((s, c) => s + c.ticketsCount, 0) +
    data.extraCards.reduce((s, c) => s + c.ticketsCount, 0);

  return (
    <>
      <AdminPageTitle
        title="Bolões apostados"
        subtitle="Visão por tipo de bolão com logos, métricas e cotas gratuitas resgatadas no brinde."
      />

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: Layers, label: "Cotas pagas", value: totalPaidTickets },
          { icon: Gift, label: "Grátis resgatadas", value: data.promoTicketsTotal, accent: true },
          { icon: Trophy, label: "Principal", value: data.principal.ticketsCount },
          {
            icon: Ticket,
            label: "Extras",
            value: data.extraCards.reduce((s, c) => s + c.ticketsCount, 0),
          },
        ].map(({ icon: Icon, label, value, accent }) => (
          <div
            key={label}
            className={`rounded-[16px] border p-4 ${
              accent ? "border-amber-400/25 bg-amber-400/8" : "border-white/8 bg-[#101010]"
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon
                className={`size-4 ${accent ? "text-amber-300" : "text-primary"}`}
                strokeWidth={2.2}
                aria-hidden
              />
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/38">{label}</p>
            </div>
            <p className="mt-2 text-[22px] font-black tabular-nums text-white">
              {value.toLocaleString("pt-BR")}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-6 rounded-[18px] border border-white/8 bg-[#101010] p-4 sm:p-5">
        <div>
          <h2 className="text-[15px] font-black text-white">Bolão principal</h2>
          <p className="mt-1 text-[12px] font-medium text-white/38">
            Copa do Mundo — ranking geral de cotas principais pagas.
          </p>
        </div>
        <AdminBolaoDashboardCard
          href="/admin/boloes/principal"
          kind="principal"
          eyebrow="FIFA World Cup"
          title="Bolão principal"
          subtitle="Ranking geral de cotas principais."
          badge={`${data.principal.totalPoints.toLocaleString("pt-BR")} pts`}
          stats={{
            ticketsCount: data.principal.ticketsCount,
            playersCount: data.principal.playersCount,
            totalPoints: data.principal.totalPoints,
          }}
        />
      </section>

      <section className="mt-4 space-y-4 rounded-[18px] border border-white/8 bg-[#101010] p-4 sm:p-5">
        <div>
          <h2 className="text-[15px] font-black text-white">Bolão dos Artilheiros</h2>
          <p className="mt-1 text-[12px] font-medium text-white/38">
            Top 3 artilheiros da Copa — resultado oficial e ranking por cota.
          </p>
        </div>
        <AdminBolaoDashboardCard
          href="/admin/boloes/artilheiros"
          kind="principal"
          eyebrow="Copa 2026"
          title="Bolão dos Artilheiros"
          subtitle="Palpites de jogadores · pontuação por posição + bônus top 3."
          badge="Artilheiros"
          stats={{ ticketsCount: 0, playersCount: 0, finishedCount: 0 }}
        />
      </section>

      <section className="mt-4 space-y-4 rounded-[18px] border border-white/8 bg-[#101010] p-4 sm:p-5">
        <div>
          <h2 className="text-[15px] font-black text-white">Bolões diários</h2>
          <p className="mt-1 text-[12px] font-medium text-white/38">
            Uma data por card — cotas com jogos naquele dia.
          </p>
        </div>
        {data.dailyCards.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.dailyCards.map((card) => (
              <AdminBolaoDashboardCard
                key={card.date}
                href={`/admin/boloes/diario?data=${encodeURIComponent(card.date)}`}
                kind="daily"
                eyebrow="Bolão do dia"
                title={card.date}
                subtitle="Palpites e ranking desta data."
                badge={`${card.totalPoints.toLocaleString("pt-BR")} pts`}
                stats={{
                  ticketsCount: card.ticketsCount,
                  playersCount: card.playersCount,
                  finishedCount: card.finishedCount,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[16px] border border-dashed border-white/12 bg-white/2 px-6 py-10 text-center">
            <Users className="mx-auto size-8 text-white/20" strokeWidth={1.75} aria-hidden />
            <p className="mt-3 text-[14px] font-black text-white">Nenhum bolão diário</p>
            <p className="mt-2 text-[12px] text-white/38">Cotas diárias pagas aparecem aqui.</p>
          </div>
        )}
      </section>

      <section className="mt-4 space-y-4 rounded-[18px] border border-white/8 bg-[#101010] p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-black text-white">Bolões extra</h2>
            <p className="mt-1 text-[12px] font-medium text-white/38">
              Agrupado por campeonato e rodada — inclui cotas do brinde grátis.
            </p>
            <Link
              href="/admin/boloes/amistosos"
              className="mt-2 inline-flex text-[12px] font-bold text-primary hover:underline"
            >
              Placares — Bolão dos Amistosos (manual)
            </Link>
          </div>
          {data.promoTicketsTotal > 0 ? (
            <p className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-[11px] font-black text-amber-200">
              <Gift className="size-3.5" strokeWidth={2.25} aria-hidden />
              {data.promoTicketsTotal.toLocaleString("pt-BR")} cotas grátis no total
            </p>
          ) : null}
        </div>
        {extraByCompetition.length ? (
          <div className="space-y-4">
            {extraByCompetition.map(([competitionName, cards]) => (
              <AdminExtraCompetitionSection
                key={competitionName}
                competitionName={competitionName}
                cards={cards}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[16px] border border-dashed border-white/12 bg-white/2 px-6 py-10 text-center">
            <Ticket className="mx-auto size-8 text-white/20" strokeWidth={1.75} aria-hidden />
            <p className="mt-3 text-[14px] font-black text-white">Nenhum bolão extra</p>
            <p className="mt-2 text-[12px] text-white/38">
              Cotas extra pagas ou resgatadas no brinde aparecem aqui.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
