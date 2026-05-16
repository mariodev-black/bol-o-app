"use client";

import type { AdminPendingWithdrawalRow } from "@/lib/admin/withdrawals";
import type { AdminAffiliateDashboardData } from "@/lib/admin/sections";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

type Tab = "affiliates" | "referred" | "commissions" | "withdrawals";
const PAGE_SIZE = 50;

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatCpa(cpaBps: number | null | undefined) {
  return `${((cpaBps ?? 0) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
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
    withdrawals: PAGE_SIZE,
  });
  const [withdrawRows, setWithdrawRows] = useState<AdminPendingWithdrawalRow[]>([]);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const cards = [
    { label: "Afiliados", value: data.affiliates.length.toLocaleString("pt-BR") },
    { label: "Influencers", value: data.stats.influencersCount.toLocaleString("pt-BR") },
    { label: "Indicados", value: data.stats.referredUsersCount.toLocaleString("pt-BR") },
    { label: "Comissões", value: data.stats.commissionsCount.toLocaleString("pt-BR") },
    { label: "Total comissões", value: formatBRL(data.stats.commissionTotalCents) },
  ];

  const visibleAffiliates = useMemo(() => data.affiliates.slice(0, visible.affiliates), [data.affiliates, visible.affiliates]);
  const visibleReferred = useMemo(() => data.referredUsers.slice(0, visible.referred), [data.referredUsers, visible.referred]);
  const visibleCommissions = useMemo(() => data.commissions.slice(0, visible.commissions), [data.commissions, visible.commissions]);
  const visibleWithdrawals = useMemo(() => withdrawRows.slice(0, visible.withdrawals), [withdrawRows, visible.withdrawals]);

  const totalByTab: Record<Tab, number> = {
    affiliates: data.affiliates.length,
    referred: data.referredUsers.length,
    commissions: data.commissions.length,
    withdrawals: withdrawRows.length,
  };
  const visibleByTab = {
    affiliates: visibleAffiliates.length,
    referred: visibleReferred.length,
    commissions: visibleCommissions.length,
    withdrawals: visibleWithdrawals.length,
  };
  const activeVisible = visible[tab];
  const hasMore = tab !== "withdrawals" && activeVisible < totalByTab[tab];

  useEffect(() => {
    if (tab !== "withdrawals") return;
    let cancelled = false;
    setWithdrawLoading(true);
    setWithdrawError(null);
    void (async () => {
      try {
        const r = await fetch("/api/admin/withdrawals", { credentials: "include" });
        const d = (await r.json()) as { items?: AdminPendingWithdrawalRow[]; error?: string };
        if (cancelled) return;
        if (r.ok && Array.isArray(d.items)) setWithdrawRows(d.items);
        else {
          setWithdrawRows([]);
          setWithdrawError(d.error || "Nao foi possivel carregar");
        }
      } catch {
        if (!cancelled) {
          setWithdrawRows([]);
          setWithdrawError("Erro de rede");
        }
      } finally {
        if (!cancelled) setWithdrawLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisible((current) => ({
          ...current,
          [tab]: Math.min(current[tab] + PAGE_SIZE, totalByTab[tab]),
        }));
      },
      { rootMargin: "240px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [activeVisible, hasMore, tab, totalByTab.affiliates, totalByTab.commissions, totalByTab.referred, totalByTab.withdrawals]);

  async function handleWithdrawAction(id: string, kind: "approve" | "reject") {
    setActionId(id);
    setWithdrawError(null);
    try {
      const r = await fetch(`/api/admin/withdrawals/${id}/${kind}`, {
        method: "POST",
        credentials: "include",
      });
      const d = (await r.json()) as { error?: string; ok?: boolean };
      if (!r.ok || !d.ok) {
        setWithdrawError(d.error || "Falha na operacao");
        return;
      }
      setWithdrawRows((list) => list.filter((row) => row.id !== id));
    } catch {
      setWithdrawError("Erro de rede");
    } finally {
      setActionId(null);
    }
  }

  function resetTab(currentTab: Tab) {
    setTab(currentTab);
    setVisible((current) => ({
      ...current,
      [currentTab]: Math.max(current[currentTab], PAGE_SIZE),
    }));
  }

  return (
    <>
      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <article key={card.label} className="rounded-[18px] border border-white/8 bg-[#101010] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/80">{card.label}</p>
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
            { id: "withdrawals" as const, label: "Saques pendentes" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => resetTab(item.id)}
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
                <tr className="text-[11px] font-black uppercase tracking-[0.16em] text-white/80">
                  <th className="px-4 py-4">Afiliado</th>
                  <th className="px-4 py-4">Modelo</th>
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
                        <p className="mt-1 text-white/80">{affiliate.email}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <span className={[
                        "rounded-full border px-3 py-1 text-[11px] font-black uppercase",
                        affiliate.affiliateMode === "influencer"
                          ? "border-primary/25 bg-primary/10 text-primary"
                          : "border-white/10 bg-white/5 text-white/58",
                      ].join(" ")}>
                        {affiliate.affiliateMode === "influencer" ? `Influencer ${formatCpa(affiliate.influencerCpaBps)}` : "Padrão"}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono text-white/80">{affiliate.referralCode ?? "-"}</td>
                    <td className="px-4 py-4 font-black text-white">{affiliate.referredUsersCount}</td>
                    <td className="px-4 py-4 font-black text-primary">{affiliate.paidReferralsCount}</td>
                    <td className="px-4 py-4">
                      <p className="font-black text-white">{formatBRL(affiliate.commissionsCents)}</p>
                      <p className="mt-1 text-[14px] text-white/80">{affiliate.commissionsCount} registros</p>
                    </td>
                    <td className="px-4 py-4 text-white/80">{formatDate(affiliate.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ScrollFooter refEl={loadMoreRef} hasMore={hasMore} visible={visibleByTab.affiliates} total={totalByTab.affiliates} label="afiliados" />
          </div>
        ) : null}

        {tab === "referred" ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1040px] w-full text-left">
              <thead className="border-b border-white/8 bg-white/2.5">
                <tr className="text-[11px] font-black uppercase tracking-[0.16em] text-white/80">
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
                        <p className="mt-1 text-white/80">{user.email}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-4 font-mono text-white/80">{maskCpf(user.cpf)}</td>
                    <td className="px-4 py-4">
                      <Link href={`/admin/users/${user.referrerId}`} className="block">
                        <p className="font-bold text-white hover:text-primary">{user.referrerName ?? "Sem nome"}</p>
                        <p className="mt-1 text-white/80">{user.referrerEmail}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-4 font-black text-primary">{user.paidTicketsCount}</td>
                    <td className="px-4 py-4 text-white/80">{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ScrollFooter refEl={loadMoreRef} hasMore={hasMore} visible={visibleByTab.referred} total={totalByTab.referred} label="usuários indicados" />
          </div>
        ) : null}

        {tab === "commissions" ? (
          <div className="overflow-x-auto">
            <table className="min-w-[960px] w-full text-left">
              <thead className="border-b border-white/8 bg-white/2.5">
                <tr className="text-[11px] font-black uppercase tracking-[0.16em] text-white/80">
                  <th className="px-4 py-4">Afiliado</th>
                  <th className="px-4 py-4">Indicado</th>
                  <th className="px-4 py-4">Valor</th>
                  <th className="px-4 py-4">Modelo</th>
                  <th className="px-4 py-4">Criada em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {visibleCommissions.map((commission) => (
                  <tr key={commission.id} className="text-[13px] text-white/72 hover:bg-white/2.5">
                    <td className="px-4 py-4">
                      <p className="font-black text-white">{commission.referrerName ?? "Sem nome"}</p>
                      <p className="mt-1 text-white/80">{commission.referrerEmail}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-white">{commission.referredName ?? "Sem nome"}</p>
                      <p className="mt-1 text-white/80">{commission.referredEmail}</p>
                    </td>
                    <td className="px-4 py-4 font-black text-primary">{formatBRL(commission.amountCents)}</td>
                    <td className="px-4 py-4 text-white/80">
                      <p className="font-black text-white">
                        {commission.commissionModel === "influencer" ? `Influencer ${formatCpa(commission.cpaBps)}` : commission.tier}
                      </p>
                      <p className="mt-1 text-[14px] text-white/30">
                        #{commission.commissionIndex}
                        {commission.baseAmountCents ? ` · base ${formatBRL(commission.baseAmountCents)}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-white/80">{formatDate(commission.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ScrollFooter refEl={loadMoreRef} hasMore={hasMore} visible={visibleByTab.commissions} total={totalByTab.commissions} label="comissões" />
          </div>
        ) : null}

        {tab === "withdrawals" ? (
          <div className="overflow-x-auto">
            {withdrawLoading ? (
              <p className="py-10 text-center text-[13px] font-bold text-white/38">Carregando saques…</p>
            ) : null}
            {withdrawError ? (
              <p className="px-4 py-3 text-center text-[13px] font-bold text-red-300">{withdrawError}</p>
            ) : null}
            {!withdrawLoading && withdrawRows.length === 0 && !withdrawError ? (
              <p className="py-10 text-center text-[13px] font-bold text-white/38">Nenhum saque pendente.</p>
            ) : null}
            {!withdrawLoading && withdrawRows.length > 0 ? (
              <table className="min-w-[920px] w-full text-left">
                <thead className="border-b border-white/8 bg-white/2.5">
                  <tr className="text-[11px] font-black uppercase tracking-[0.16em] text-white/80">
                    <th className="px-4 py-4">Usuário</th>
                    <th className="px-4 py-4">Origem</th>
                    <th className="px-4 py-4">Valor</th>
                    <th className="px-4 py-4">PIX</th>
                    <th className="px-4 py-4">Solicitado</th>
                    <th className="px-4 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {visibleWithdrawals.map((row) => (
                    <tr key={row.id} className="text-[13px] text-white/72">
                      <td className="px-4 py-4">
                        <Link href={`/admin/users/${row.userId}`} className="block">
                          <p className="font-black text-white hover:text-primary">{row.userName ?? "Sem nome"}</p>
                          <p className="mt-1 text-white/80">{row.userEmail}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={[
                            "rounded-full border px-3 py-1 text-[11px] font-black uppercase",
                            row.balanceSource === "wallet"
                              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                              : "border-primary/25 bg-primary/10 text-primary",
                          ].join(" ")}
                        >
                          {row.balanceSource === "wallet" ? "Conta" : "Afiliado"}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-black text-primary">{formatBRL(row.amountCents)}</td>
                      <td className="px-4 py-4 text-white/80">
                        <p className="font-bold text-white/70 uppercase text-[11px]">{row.pixKeyType}</p>
                        <p className="mt-1 font-mono text-[12px] break-all">{row.pixKey}</p>
                      </td>
                      <td className="px-4 py-4 text-white/80">{formatDate(row.createdAt)}</td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            disabled={actionId === row.id}
                            onClick={() => void handleWithdrawAction(row.id, "approve")}
                            className="rounded-full bg-primary px-4 py-2 text-[11px] font-black uppercase tracking-wide text-black disabled:opacity-40"
                          >
                            {actionId === row.id ? "…" : "Aprovar"}
                          </button>
                          <button
                            type="button"
                            disabled={actionId === row.id}
                            onClick={() => void handleWithdrawAction(row.id, "reject")}
                            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] font-black uppercase tracking-wide text-white/72 hover:bg-white/10 disabled:opacity-40"
                          >
                            Recusar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {withdrawRows.length > 0 ? (
              <div className="border-t border-white/8 px-5 py-4 text-center">
                <p className="text-[12px] font-bold text-white/38">
                  {withdrawRows.length} solicitaç{withdrawRows.length === 1 ? "ão" : "ões"} pendente
                  {withdrawRows.length === 1 ? "" : "s"}.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </>
  );
}

function ScrollFooter({
  refEl,
  hasMore,
  visible,
  total,
  label,
}: {
  refEl: RefObject<HTMLDivElement | null>;
  hasMore: boolean;
  visible: number;
  total: number;
  label: string;
}) {
  if (total === 0) return null;
  return (
    <div ref={refEl} className="border-t border-white/8 px-5 py-5 text-center">
      <p className="text-[12px] font-bold text-white/38">
        {hasMore ? `Carregando mais ${label} de ${PAGE_SIZE} em ${PAGE_SIZE}...` : `Todos os ${label} foram exibidos. (${visible}/${total})`}
      </p>
    </div>
  );
}
