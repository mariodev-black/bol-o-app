import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AdminBolaoKindIcon } from "@/app/admin/(panel)/boloes/_components/AdminBolaoKindIcon";
import { formatAdminRodadaLabel } from "@/lib/admin/format";
import type { AdminExtraBolaoCard } from "@/lib/admin/sections";

function extraCardScopeLabel(card: AdminExtraBolaoCard): string {
  if (card.key.endsWith(":copa")) return "Copa integral";
  return formatAdminRodadaLabel(card.rodada);
}

function formatCount(n: number): string {
  return n.toLocaleString("pt-BR");
}

function ExtraRodadaRow({ card }: { card: AdminExtraBolaoCard }) {
  const href = `/admin/boloes/extra?key=${encodeURIComponent(card.key)}`;

  return (
    <>
      <Link
        href={href}
        className="group hidden grid-cols-[minmax(0,1.15fr)_repeat(4,minmax(64px,1fr))_72px] items-center gap-2 border-b border-white/5 px-4 py-3.5 transition-colors last:border-b-0 hover:bg-white/4 sm:grid sm:px-5"
      >
        <p className="min-w-0 text-[14px] font-black text-white">
          {extraCardScopeLabel(card)}
        </p>
        <p className="text-right text-[14px] font-bold tabular-nums text-white">
          {formatCount(card.ticketsCount)}
        </p>
        <p className="text-right text-[14px] font-bold tabular-nums text-white/85">
          {formatCount(card.playersCount)}
        </p>
        <p className="text-right text-[14px] font-bold tabular-nums text-white/85">
          {formatCount(card.finishedCount)}
        </p>
        <p
          className={`text-right text-[14px] font-bold tabular-nums ${
            card.promoTicketsCount > 0 ? "text-amber-300" : "text-white/35"
          }`}
        >
          {formatCount(card.promoTicketsCount)}
        </p>
        <span className="flex justify-end text-primary opacity-80 transition-opacity group-hover:opacity-100">
          <ArrowRight className="size-4" strokeWidth={2.5} aria-hidden />
        </span>
      </Link>

      <Link
        href={href}
        className="flex items-center gap-3 border-b border-white/5 px-4 py-3.5 transition-colors last:border-b-0 hover:bg-white/4 sm:hidden"
      >
        <div
          className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5"
          aria-hidden
        >
          <span className="text-[9px] font-black uppercase text-white/40">
            {card.key.endsWith(":copa") ? "Copa" : "Rod."}
          </span>
          <span className="text-[15px] font-black leading-none tabular-nums text-primary">
            {card.key.endsWith(":copa") ? "∑" : card.rodada}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-black text-white">{extraCardScopeLabel(card)}</p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-medium text-white/45">
            <span>{formatCount(card.ticketsCount)} cotas</span>
            <span>{formatCount(card.finishedCount)} fin.</span>
            {card.promoTicketsCount > 0 ? (
              <span className="text-amber-300/90">{formatCount(card.promoTicketsCount)} grátis</span>
            ) : null}
          </p>
        </div>
        <ArrowRight className="size-4 shrink-0 text-primary/80" strokeWidth={2.5} aria-hidden />
      </Link>
    </>
  );
}

export function AdminExtraCompetitionSection({
  competitionName,
  cards,
}: {
  competitionName: string;
  cards: AdminExtraBolaoCard[];
}) {
  const variant = cards[0]?.iconVariant;
  const totalTickets = cards.reduce((sum, card) => sum + card.ticketsCount, 0);
  const totalPromo = cards.reduce((sum, card) => sum + card.promoTicketsCount, 0);
  const roundLabel = cards.length === 1 ? "1 rodada" : `${cards.length} rodadas`;

  return (
    <div className="overflow-hidden rounded-[16px] border border-white/8 bg-[#0c0c0c]">
      <div className="flex items-center gap-3 border-b border-white/8 bg-[#101010] px-4 py-4 sm:px-5">
        <AdminBolaoKindIcon kind="extra" extraVariant={variant} size="sm" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-black leading-tight text-white">{competitionName}</h3>
          <p className="mt-1 text-[12px] font-medium text-white/42">
            {roundLabel} · {formatCount(totalTickets)} cotas
            {totalPromo > 0 ? ` · ${formatCount(totalPromo)} grátis` : ""}
          </p>
        </div>
      </div>

      <div className="hidden border-b border-white/6 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white/32 sm:grid sm:grid-cols-[minmax(0,1.15fr)_repeat(4,minmax(64px,1fr))_72px] sm:gap-2 sm:px-5">
        <span>Rodada</span>
        <span className="text-right">Cotas</span>
        <span className="text-right">Jogadores</span>
        <span className="text-right">Finalizadas</span>
        <span className="text-right">Grátis</span>
        <span className="sr-only">Abrir</span>
      </div>

      <div>
        {cards.map((card) => (
          <ExtraRodadaRow key={card.key} card={card} />
        ))}
      </div>
    </div>
  );
}
