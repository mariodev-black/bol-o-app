"use client";

import { formatAdminTicketType } from "@/lib/admin/format";
import type { AdminTransactionListItem } from "@/lib/admin/sections";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 50;

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "paid" || normalized === "approved") return "Pago";
  if (
    ["pending_payment", "pending", "creating", "waiting_payment"].includes(
      normalized,
    )
  )
    return "Pendente";
  if (
    ["failed", "canceled", "cancelled", "refused", "expired"].includes(
      normalized,
    )
  )
    return "Falhou";
  return status || "Nao informado";
}

function statusClassName(status: string) {
  const label = statusLabel(status);
  if (label === "Pago") return "border-primary/20 bg-primary/10 text-primary";
  if (label === "Pendente")
    return "border-orange-400/25 bg-orange-400/10 text-orange-200";
  if (label === "Falhou") return "border-red-400/25 bg-red-400/10 text-red-200";
  return "border-white/10 bg-white/5 text-white/55";
}

export function AdminTransactionsClient({
  transactions,
}: {
  transactions: AdminTransactionListItem[];
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const visibleTransactions = useMemo(
    () => transactions.slice(0, visibleCount),
    [transactions, visibleCount],
  );
  const hasMore = visibleCount < transactions.length;

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisibleCount((current) =>
          Math.min(current + PAGE_SIZE, transactions.length),
        );
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, transactions.length, visibleCount]);

  return (
    <section className="overflow-hidden rounded-[18px] border border-white/8 bg-[#101010]">
      <div className="overflow-x-auto">
        <table className="min-w-[1180px] w-full text-left">
          <thead className="border-b border-white/8 bg-white/2.5">
            <tr className="text-[11px] font-black uppercase tracking-[0.16em] text-white/35">
              <th className="px-4 py-4">Transação</th>
              <th className="px-4 py-4">Usuário</th>
              <th className="px-4 py-4">Cota</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-4 py-4">Valor</th>
              <th className="px-4 py-4">Método</th>
              <th className="px-4 py-4">Criada em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {visibleTransactions.map((transaction) => (
              <tr
                key={transaction.id}
                className="text-[13px] text-white/72 transition-colors hover:bg-white/2.5"
              >
                <td className="px-4 py-4">
                  <p className="font-mono text-[11px] text-white/50">
                    {transaction.id}
                  </p>
                  {transaction.providerTransactionId ? (
                    <p className="mt-1 font-mono text-[10px] text-white/25">
                      {transaction.providerTransactionId}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-4">
                  <Link
                    href={`/admin/users/${transaction.userId}`}
                    className="block"
                  >
                    <p className="font-bold text-white hover:text-primary">
                      {transaction.userName ?? "Sem nome"}
                    </p>
                    <p className="mt-1 text-white/35">
                      {transaction.userEmail}
                    </p>
                  </Link>
                </td>
                <td className="px-4 py-4">
                  {transaction.ticketId ? (
                    <Link
                      href={`/admin/cotas/${transaction.ticketId}`}
                      className="block"
                    >
                      <p className="font-mono text-[11px] text-white/45 hover:text-primary">
                        {transaction.ticketId}
                      </p>
                      <p className="mt-1 font-bold uppercase text-white/35">
                        {formatAdminTicketType(transaction.ticketType)}
                      </p>
                    </Link>
                  ) : (
                    <span className="text-white/30">Sem cota</span>
                  )}
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase ${statusClassName(transaction.status)}`}
                  >
                    {statusLabel(transaction.status)}
                  </span>
                </td>
                <td className="px-4 py-4 font-black text-white">
                  {formatBRL(transaction.amountCents)}
                </td>
                <td className="px-4 py-4">
                  <p className="font-bold uppercase text-white/58">
                    {transaction.paymentMethod}
                  </p>{" "}
                </td>
                <td className="px-4 py-4 text-white/45">
                  {formatDate(transaction.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-[15px] font-black text-white">
              Nenhuma transação encontrada
            </p>
            <p className="mt-2 text-[13px] text-white/38">
              Quando houver cobranças geradas, elas aparecem aqui.
            </p>
          </div>
        ) : (
          <div
            ref={loadMoreRef}
            className="border-t border-white/8 px-5 py-5 text-center"
          >
            <p className="text-[12px] font-bold text-white/38">
              {hasMore
                ? `Carregando mais transações de ${PAGE_SIZE} em ${PAGE_SIZE}...`
                : `Todas as transações foram exibidas. (${visibleTransactions.length}/${transactions.length})`}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
