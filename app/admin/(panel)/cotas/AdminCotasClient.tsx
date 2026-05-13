"use client";

import { formatAdminTicketType } from "@/lib/admin/format";
import type { AdminTicketListItem } from "@/lib/admin/sections";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 50;

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function cotaUsageStatus(ticket: AdminTicketListItem) {
  if (ticket.predictionsCount <= 0) return "Disponível";
  if (ticket.pendingPredictionsCount > 0) return "Em uso";
  return "Finalizada";
}

function cotaUsageStatusClassName(status: string) {
  if (status === "Disponível") return "border-white/10 bg-white/5 text-white/62";
  if (status === "Em uso") return "border-orange-400/25 bg-orange-400/10 text-orange-200";
  return "border-primary/20 bg-primary/10 text-primary";
}

export function AdminCotasClient({ tickets }: { tickets: AdminTicketListItem[] }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const visibleTickets = useMemo(() => tickets.slice(0, visibleCount), [tickets, visibleCount]);
  const hasMore = visibleCount < tickets.length;

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisibleCount((current) => Math.min(current + PAGE_SIZE, tickets.length));
      },
      { rootMargin: "240px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, tickets.length, visibleCount]);

  return (
    <section className="overflow-hidden rounded-[18px] border border-white/8 bg-[#101010]">
      <div className="overflow-x-auto">
        <table className="min-w-[1240px] w-full table-fixed text-left">
          <thead className="border-b border-white/8 bg-white/2.5">
            <tr className="text-[11px] font-black uppercase tracking-[0.16em] text-white/80">
              <th className="w-[110px] px-4 py-4">Cota</th>
              <th className="w-[210px] px-4 py-4">Usuário</th>
              <th className="w-[110px] px-4 py-4">Tipo</th>
              <th className="w-[120px] px-4 py-4">Status</th>
              <th className="w-[70px] px-4 py-4 text-center">Qtd.</th>
              <th className="w-[110px] px-4 py-4">Valor</th>
              <th className="w-[110px] px-4 py-4">Pontuação</th>
              <th className="w-[100px] px-4 py-4 text-center">Ranking mod.</th>
              <th className="w-[120px] px-4 py-4">Palpites</th>
              <th className="w-[100px] px-4 py-4 text-center">Pend.</th>
              <th className="w-[110px] px-4 py-4">Criada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {visibleTickets.map((ticket) => (
              <tr key={ticket.id} className="group text-[13px] text-white/72 transition-colors hover:bg-white/2.5">
                <td className="px-4 py-4">
                  <Link href={`/admin/cotas/${ticket.id}`} className="block">
                    <p className="font-mono text-[12px] font-black text-white group-hover:text-primary">#{shortId(ticket.id)}</p>
                    {ticket.externalRef ? <p className="mt-1 truncate font-mono text-[12px] text-white/25">{ticket.externalRef}</p> : null}
                  </Link>
                </td>
                <td className="px-4 py-4">
                  <Link href={`/admin/cotas/${ticket.id}`} className="block">
                    <p className="truncate font-bold text-white group-hover:text-primary">{ticket.userName ?? "Sem nome"}</p>
                    <p className="mt-1 truncate text-white/80">{ticket.userEmail}</p>
                  </Link>
                </td>
                <td className="px-4 py-4 font-bold uppercase text-white/58">
                  <Link href={`/admin/cotas/${ticket.id}`} className="block">{formatAdminTicketType(ticket.ticketType)}</Link>
                </td>
                <td className="px-4 py-4">
                  <Link href={`/admin/cotas/${ticket.id}`} className="block">
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase ${cotaUsageStatusClassName(cotaUsageStatus(ticket))}`}>
                      {cotaUsageStatus(ticket)}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-4 text-center font-black text-white">
                  <Link href={`/admin/cotas/${ticket.id}`} className="block">{ticket.quantity}</Link>
                </td>
                <td className="px-4 py-4 font-black text-white">
                  <Link href={`/admin/cotas/${ticket.id}`} className="block">{formatBRL(ticket.totalAmountCents)}</Link>
                </td>
                <td className="px-4 py-4">
                  <Link href={`/admin/cotas/${ticket.id}`} className="block">
                    <p className="text-[18px] font-black leading-none text-primary">{ticket.scorePoints.toLocaleString("pt-BR")}</p>
                    <p className="mt-1 text-[11px] font-bold text-white/80">pontos</p>
                  </Link>
                </td>
                <td className="px-4 py-4 text-center">
                  <Link href={`/admin/cotas/${ticket.id}`} className="block">
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase text-primary">
                      {ticket.rankingPosition ? `#${ticket.rankingPosition}` : "-"}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-4">
                  <Link href={`/admin/cotas/${ticket.id}`} className="block">
                    <p className="font-black text-white">
                      {ticket.predictionsCount}/{ticket.totalMatchesCount}
                    </p>
                    <p className="mt-1 text-[11px] text-white/80">enviados</p>
                  </Link>
                </td>
                <td className="px-4 py-4 text-center">
                  <Link href={`/admin/cotas/${ticket.id}`} className="block">
                    <span className={[
                      "rounded-full px-3 py-1 text-[11px] font-black uppercase",
                      ticket.pendingPredictionsCount > 0
                        ? "border border-orange-400/25 bg-orange-400/10 text-orange-200"
                        : "border border-primary/20 bg-primary/10 text-primary",
                    ].join(" ")}>
                      {ticket.pendingPredictionsCount}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-4 text-white/80">
                  <Link href={`/admin/cotas/${ticket.id}`} className="block">
                    {new Intl.DateTimeFormat("pt-BR").format(new Date(ticket.createdAt))}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tickets.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-[15px] font-black text-white">Nenhuma cota encontrada</p>
            <p className="mt-2 text-[13px] text-white/38">Quando houver cotas compradas, elas aparecem aqui.</p>
          </div>
        ) : (
          <div ref={loadMoreRef} className="border-t border-white/8 px-5 py-5 text-center">
            <p className="text-[12px] font-bold text-white/38">
              {hasMore ? `Carregando mais cotas de ${PAGE_SIZE} em ${PAGE_SIZE}...` : `Todas as cotas foram exibidas. (${visibleTickets.length}/${tickets.length})`}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
