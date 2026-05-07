"use client";

import type { AdminAffiliateDashboardData } from "@/lib/admin/sections";
import Link from "next/link";
import { useMemo, useState } from "react";

type Tab = "affiliates" | "referred" | "commissions";
const PAGE_SIZE = 50;

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function maskCpf(cpf: string | null) {
  const digits = (cpf ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return cpf || "-";
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function AdminAffiliatesClient({ data }: { data: AdminAffiliateDashboardData }) {
  const [tab, setTab] = useState<Tab>("affiliates");
  const [visible, setVisible] = useState<Record<Tab, number>>({
    affiliates: PAGE_SIZE,
    referred: PAGE_SIZE,
    commissions: PAGE_SIZE,
  });

  const cards = [
    { label: "Afiliados", value: data.affiliates.length.toLocaleString("pt-BR") },
    { label: "Indicados", value: data.stats.referredUsersCount.toLocaleString("pt-BR") },
    { label: "Comissões", value: data.stats.commissionsCount.toLocaleString("pt-BR") },
    { label: "Total comissões", value: formatBRL(data.stats.commissionTotalCents) },
  ];

  const visibleAffiliates = useMemo(() => data.affiliates.slice(0, visible.affiliates), [data.affiliates, visible.affiliates]);
  const visibleReferred = useMemo(() => data.referredUsers.slice(0, visible.referred), [data.referredUsers, visible.referred]);
  const visibleCommissions = useMemo(() => data.commissions.slice(0, visible.commissions), [data.commissions, visible.commissions]);

  function loadMore(currentTab: Tab, total: number) {
    setVisible((current) => ({
      ...current,
      [currentTab]: Math.min(current[currentTab] + PAGE_SIZE, total),
    }));
  }

  return (
    <>
      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-[18px] border border-white/8 bg-[#101010] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">{card.label}</p>
            <p className="mt-4 text-[28px] font-black leading-none tracking-[-0.05em] text-primary">{card.value}</p>
          </article>
        ))}
      </div>

      <section className="rounded-[18px] border border-white/8 bg-[#101010]">
        <div className="flex flex-wrap gap-2 border-b border-white/8 p-3">
          {[
            { id: "affiliates" as const, label: "Dados afiliados" },
            { id: "referred" as const, label: "Usuários indicados" },
            { id: "commissions" as const, label: "Comissões" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={[
                "h-10 rounded-full px-4 text-[12px] font-black uppercase tracking-[0.12em] transition-colors",
                tab === item.id
                  ? "bg-primary text-black"
                  : "border border-white/10 bg-white/5 text-white/48 hover:text-white",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "affiliates" ? (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left">
              <thead className="border-b border-white/8 bg-white/2.5">
                <tr className="text-[11px] font-black uppercase tracking-[0.16em] text-white/35">
                  <th className="px-4 py-4">Afiliado</th>
                  <th className="px-4 py-4">Código</th>
                  <th className="px-4 py-4">Indicados</th>
                  <th className="px-4 py-4">Pagos</th>
                  <th className="px-4 py-4">Comissões</th>
                  <th className="px-4 py-4">Criado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {visibleAffiliates.map((affiliate) => (
                  <tr key={affiliate.id} className="text-[13px] text-white/72 hover:bg-white/2.5">
                    <td className="px-4 py-4">
                      <Link href={`/admin/users/${affiliate.id}`} className="block">
                        <p className="font-black text-white hover:text-primary">{affiliate.name ?? "Sem nome"}</p>
                        <p className="mt-1 text-white/35">{affiliate.email}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-4 font-mono text-white/45">{affiliate.referralCode ?? "-"}</td>
                    <td className="px-4 py-4 font-black text-white">{affiliate.referredUsersCount}</td>
                    <td className="px-4 py-4 font-black text-primary">{affiliate.paidReferralsCount}</td>
                    <td className="px-4 py-4">
                      <p className="font-black text-white">{formatBRL(affiliate.commissionsCents)}</p>
                      <p className="mt-1 text-[11px] text-white/35">{affiliate.commissionsCount} registros</p>
                    </td>
                    <td className="px-4 py-4 text-white/45">{formatDate(affiliate.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleAffiliates.length < data.affiliates.length ? (
              <LoadMore onClick={() => loadMore("affiliates", data.affiliates.length)} />
            ) : null}
          </div>
        ) : null}

        {tab === "referred" ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1040px] w-full text-left">
              <thead className="border-b border-white/8 bg-white/2.5">
                <tr className="text-[11px] font-black uppercase tracking-[0.16em] text-white/35">
                  <th className="px-4 py-4">Usuário indicado</th>
                  <th className="px-4 py-4">CPF</th>
                  <th className="px-4 py-4">Afiliado</th>
                  <th className="px-4 py-4">Cotas pagas</th>
                  <th className="px-4 py-4">Entrou em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {visibleReferred.map((user) => (
                  <tr key={user.id} className="text-[13px] text-white/72 hover:bg-white/2.5">
                    <td className="px-4 py-4">
                      <Link href={`/admin/users/${user.id}`} className="block">
                        <p className="font-black text-white hover:text-primary">{user.name ?? "Sem nome"}</p>
                        <p className="mt-1 text-white/35">{user.email}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-4 font-mono text-white/45">{maskCpf(user.cpf)}</td>
                    <td className="px-4 py-4">
                      <Link href={`/admin/users/${user.referrerId}`} className="block">
                        <p className="font-bold text-white hover:text-primary">{user.referrerName ?? "Sem nome"}</p>
                        <p className="mt-1 text-white/35">{user.referrerEmail}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-4 font-black text-primary">{user.paidTicketsCount}</td>
                    <td className="px-4 py-4 text-white/45">{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleReferred.length < data.referredUsers.length ? (
              <LoadMore onClick={() => loadMore("referred", data.referredUsers.length)} />
            ) : null}
          </div>
        ) : null}

        {tab === "commissions" ? (
          <div className="overflow-x-auto">
            <table className="min-w-[960px] w-full text-left">
              <thead className="border-b border-white/8 bg-white/2.5">
                <tr className="text-[11px] font-black uppercase tracking-[0.16em] text-white/35">
                  <th className="px-4 py-4">Afiliado</th>
                  <th className="px-4 py-4">Indicado</th>
                  <th className="px-4 py-4">Valor</th>
                  <th className="px-4 py-4">Tier</th>
                  <th className="px-4 py-4">Criada em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {visibleCommissions.map((commission) => (
                  <tr key={commission.id} className="text-[13px] text-white/72 hover:bg-white/2.5">
                    <td className="px-4 py-4">
                      <p className="font-black text-white">{commission.referrerName ?? "Sem nome"}</p>
                      <p className="mt-1 text-white/35">{commission.referrerEmail}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-white">{commission.referredName ?? "Sem nome"}</p>
                      <p className="mt-1 text-white/35">{commission.referredEmail}</p>
                    </td>
                    <td className="px-4 py-4 font-black text-primary">{formatBRL(commission.amountCents)}</td>
                    <td className="px-4 py-4 text-white/45">{commission.tier} #{commission.commissionIndex}</td>
                    <td className="px-4 py-4 text-white/45">{formatDate(commission.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleCommissions.length < data.commissions.length ? (
              <LoadMore onClick={() => loadMore("commissions", data.commissions.length)} />
            ) : null}
          </div>
        ) : null}
      </section>
    </>
  );
}

function LoadMore({ onClick }: { onClick: () => void }) {
  return (
    <div className="border-t border-white/8 px-5 py-5 text-center">
      <button
        type="button"
        onClick={onClick}
        className="rounded-full border border-primary/25 bg-primary/10 px-5 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-primary hover:bg-primary/15"
      >
        Carregar mais 50
      </button>
    </div>
  );
}
