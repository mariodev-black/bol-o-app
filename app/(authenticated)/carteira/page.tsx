"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  Loader2,
  Plus,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/app/shared/AuthContext";
import { formatBRLFromCents } from "@/lib/wallet/format";
import { WalletDepositSheet } from "./WalletDepositSheet";

type WalletEntry = {
  id: string;
  amountCents: number;
  type: string;
  status: string;
  balanceAfter: number;
  createdAt: string;
};

type Summary = {
  balanceCents: number;
  affiliateBalanceCents: number;
  blockedCents: number;
  totalDepositedCents: number;
  totalWithdrawnCents: number;
  totalWonCents: number;
  totalSpentCents: number;
  entries: WalletEntry[];
  hasMore: boolean;
  nextBefore: string | null;
};

const TYPE_META: Record<string, { label: string; icon: typeof Wallet }> = {
  opening_balance: { label: "Saldo inicial", icon: Wallet },
  deposit_pix: { label: "Depósito via PIX", icon: ArrowDownLeft },
  purchase: { label: "Compra", icon: ShoppingBag },
  prize: { label: "Prêmio", icon: Gift },
  withdrawal: { label: "Saque", icon: ArrowUpRight },
  refund: { label: "Estorno", icon: RotateCcw },
  bonus: { label: "Bônus", icon: Sparkles },
  commission: { label: "Comissão de afiliado", icon: Users },
  adjustment: { label: "Ajuste", icon: Wallet },
};

function entryMeta(type: string) {
  return TYPE_META[type] ?? { label: type, icon: Wallet };
}

function statusLabel(status: string): string {
  switch (status) {
    case "settled":
      return "Concluído";
    case "pending":
      return "Pendente";
    case "processing":
      return "Em processamento";
    case "failed":
      return "Falhou";
    default:
      return status;
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function StatCard({
  label,
  cents,
  ready,
}: {
  label: string;
  cents: number;
  ready: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/25 px-3.5 py-3">
      <p className="text-[11px] font-semibold text-white/45">{label}</p>
      <p className="mt-1 text-[16px] font-black tabular-nums text-white">
        {ready ? formatBRLFromCents(cents) : "…"}
      </p>
    </div>
  );
}

export default function CarteiraPage() {
  const { user, refresh } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [entries, setEntries] = useState<WalletEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/wallet/summary", { credentials: "include" });
      const data = (await r.json()) as Summary;
      if (r.ok) {
        setSummary(data);
        setEntries(data.entries ?? []);
      }
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!summary?.nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await fetch(
        `/api/wallet/summary?before=${encodeURIComponent(summary.nextBefore)}`,
        { credentials: "include" },
      );
      const data = (await r.json()) as Summary;
      if (r.ok) {
        setEntries((prev) => [...prev, ...(data.entries ?? [])]);
        setSummary((prev) => (prev ? { ...prev, hasMore: data.hasMore, nextBefore: data.nextBefore } : prev));
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  }, [summary?.nextBefore, loadingMore]);

  const balanceCents = summary?.balanceCents ?? user?.balanceCents ?? 0;
  const blocked = summary?.blockedCents ?? 0;
  const affiliateBalance = summary?.affiliateBalanceCents ?? 0;
  // Agregados só têm "plano B" depois que o summary carrega (diferente do saldo,
  // que reaproveita o valor já vindo do login). Evita exibir R$ 0,00 falso.
  const ready = summary != null;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6 pb-24 sm:px-6 md:max-w-2xl md:py-8">
      <h1 className="mb-2 text-[26px] font-black tracking-tight text-white md:text-3xl">Carteira</h1>
      <p className="mb-6 text-[14px] leading-relaxed text-white/40">
        Adicione saldo, use para comprar cotas e acompanhe todas as suas movimentações.
      </p>

      {/* Saldo + ações */}
      <section className="mb-4 overflow-hidden rounded-2xl border border-white/8 p-5" style={{ background: "#101010" }}>
        <div className="flex items-center gap-2 text-white/55">
          <Wallet className="size-4 text-[#B1EB0B]" strokeWidth={2.25} />
          <span className="text-[11px] font-bold uppercase tracking-wider">Saldo disponível</span>
        </div>
        <p className="mt-2 text-4xl font-black tabular-nums text-white md:text-5xl">
          {formatBRLFromCents(balanceCents)}
        </p>
        {blocked > 0 ? (
          <p className="mt-1.5 text-[12px] text-amber-300/80">
            {formatBRLFromCents(blocked)} bloqueado (saque em análise)
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setDepositOpen(true)}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#B1EB0B] text-[14px] font-black uppercase tracking-wide text-[#0E141B] transition active:scale-[0.98]"
          >
            <Plus className="size-4" strokeWidth={3} />
            Adicionar
          </button>
          <Link
            href="/saques"
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] text-[14px] font-black uppercase tracking-wide text-white transition hover:bg-white/[0.08] active:scale-[0.98]"
          >
            <ArrowUpRight className="size-4" strokeWidth={2.5} />
            Sacar
          </Link>
        </div>
      </section>

      {/* Composição do saldo — o afiliado já está incluso no total acima, não é um bolso à parte */}
      {affiliateBalance > 0 ? (
        <section
          className="mb-4 flex items-center gap-3 rounded-2xl border border-white/8 px-5 py-4"
          style={{ background: "#101010" }}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">
            <Users className="size-4" strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-white">
              {formatBRLFromCents(affiliateBalance)} de comissões de afiliado
            </p>
            <p className="mt-0.5 text-[11px] text-white/40">Já incluído no saldo disponível acima</p>
          </div>
        </section>
      ) : null}

      {/* Central Financeira */}
      <section className="mb-6 grid grid-cols-2 gap-2.5">
        <StatCard label="Total depositado" cents={summary?.totalDepositedCents ?? 0} ready={ready} />
        <StatCard label="Total sacado" cents={summary?.totalWithdrawnCents ?? 0} ready={ready} />
        <StatCard label="Ganho em prêmios" cents={summary?.totalWonCents ?? 0} ready={ready} />
        <StatCard label="Gasto em cotas" cents={summary?.totalSpentCents ?? 0} ready={ready} />
      </section>

      {/* Extrato */}
      <section className="rounded-2xl border border-white/8 p-5" style={{ background: "#101010" }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-[#B1EB0B]">Extrato</p>
            <h2 className="text-lg font-black text-white">Suas movimentações</h2>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-white/40">
            <Loader2 className="size-4 animate-spin" />
            Carregando…
          </div>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-white/35">
            Nenhuma movimentação ainda. Adicione saldo para começar.
          </p>
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-white/[0.06]">
              {entries.map((e) => {
                const meta = entryMeta(e.type);
                const Icon = meta.icon;
                const credit = e.amountCents >= 0;
                return (
                  <li key={e.id} className="flex items-center gap-3 py-3">
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                        credit ? "bg-emerald-400/10 text-emerald-300" : "bg-white/[0.06] text-white/60"
                      }`}
                    >
                      <Icon className="size-4" strokeWidth={2.25} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold text-white">{meta.label}</p>
                      <p className="text-[12px] text-white/40">
                        {formatDateTime(e.createdAt)} · {statusLabel(e.status)}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 text-[14px] font-black tabular-nums ${
                        credit ? "text-emerald-300" : "text-white"
                      }`}
                    >
                      {credit ? "+" : "−"}
                      {formatBRLFromCents(Math.abs(e.amountCents))}
                    </p>
                  </li>
                );
              })}
            </ul>

            {summary?.hasMore ? (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] text-[13px] font-bold text-white/70 transition hover:bg-white/[0.08] disabled:opacity-40"
              >
                {loadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
                Carregar mais
              </button>
            ) : null}
          </>
        )}
      </section>

      <WalletDepositSheet
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        onPaid={() => {
          void load();
          void refresh();
        }}
      />
    </div>
  );
}
