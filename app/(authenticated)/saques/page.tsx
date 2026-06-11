"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { AffiliateSummary } from "../indique/affiliate-types";
import { formatBRLFromCents } from "../indique/affiliate-types";
import { WithdrawGanhosModal } from "../indique/WithdrawGanhosModal";
import { fetchAffiliateSummaryCached, invalidateAffiliateSummaryCache } from "../indique/affiliate-summary-cache";
import { WithdrawHistoryList } from "./WithdrawHistoryList";
import { useWithdrawHistory } from "./useWithdrawHistory";

export default function SaquesPage() {
  const [summary, setSummary] = useState<AffiliateSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const { items, loading: historyLoading, reload: reloadHistory } = useWithdrawHistory(50);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const nextSummary = await fetchAffiliateSummaryCached();
      setSummary(nextSummary);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reloadAll = useCallback(async () => {
    invalidateAffiliateSummaryCache();
    await Promise.all([load(), reloadHistory()]);
  }, [load, reloadHistory]);

  const affiliateAvail = summary?.balances.availableCents ?? 0;
  const walletAvail = summary?.balances.walletBalanceCents ?? 0;
  const pendingAffiliate = summary?.balances.pendingWithdrawalCents ?? 0;
  const pendingWallet = summary?.balances.pendingWalletWithdrawalCents ?? 0;
  const minCents = summary?.minWithdrawalCents ?? 2000;

  return (
    <div className="flex flex-1 flex-col px-4 sm:px-6 py-6 md:py-8 max-w-lg md:max-w-2xl mx-auto w-full pb-24">
      <Link
        href="/indique"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold mb-6 w-fit transition-opacity hover:opacity-80"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        <ChevronLeft className="w-4 h-4" />
        Voltar para indicações
      </Link>

      <h1 className="text-[26px] md:text-3xl font-black text-white tracking-tight mb-2">Sacar ganhos</h1>
      <p className="text-[14px] leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.42)" }}>
        Solicite o resgate do saldo de afiliado ou da conta. O valor é descontado na hora e fica em análise até a
        equipe aprovar ou recusar.
      </p>

      <section className="rounded-2xl border border-white/8 p-5 mb-6" style={{ background: "#101010" }}>
        {loading ? (
          <div className="flex items-center gap-2 text-white/40 text-sm py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando saldos…
          </div>
        ) : (
          <>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/80 mb-3">Seus saldos</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/8 bg-black/25 px-4 py-3">
                <p className="text-[12px] font-semibold text-white/50">Saldo afiliado</p>
                <p className="text-2xl font-black text-primary mt-1">{formatBRLFromCents(affiliateAvail)}</p>
                {pendingAffiliate > 0 ? (
                  <p className="text-[12px] mt-2 text-white/40">Em análise: {formatBRLFromCents(pendingAffiliate)}</p>
                ) : null}
              </div>
              <div className="rounded-xl border border-white/8 bg-black/25 px-4 py-3">
                <p className="text-[12px] font-semibold text-white/50">Saldo conta</p>
                <p className="text-2xl font-black text-emerald-300 mt-1">{formatBRLFromCents(walletAvail)}</p>
                {pendingWallet > 0 ? (
                  <p className="text-[12px] mt-2 text-white/40">Em análise: {formatBRLFromCents(pendingWallet)}</p>
                ) : null}
              </div>
            </div>
            <p className="mt-3 text-[12px] text-white/35">
              Mínimo por solicitação: {formatBRLFromCents(minCents)}
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              disabled={loading || (affiliateAvail < minCents && walletAvail < minCents)}
              className="mt-4 flex h-12 w-full items-center justify-center gap-1 rounded-xl bg-primary font-black text-[15px] uppercase tracking-wide text-black disabled:opacity-40"
            >
              Solicitar saque
              <ChevronRight className="size-4" strokeWidth={2.6} />
            </button>
            {affiliateAvail < minCents && walletAvail < minCents ? (
              <p className="mt-2 text-center text-[12px] text-white/45">Saldo abaixo do mínimo para solicitar saque.</p>
            ) : null}
          </>
        )}
      </section>

      <section className="rounded-2xl border border-white/8 p-5" style={{ background: "#101010" }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-primary">Histórico</p>
            <h2 className="text-lg font-black text-white">Suas solicitações</h2>
          </div>
          {!historyLoading && items.length > 0 ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-white/45">
              {items.length}
            </span>
          ) : null}
        </div>
        <WithdrawHistoryList items={items} loading={historyLoading} />
      </section>

      <WithdrawGanhosModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        summary={summary}
        summaryLoading={loading}
        onReloadSummary={reloadAll}
        onSuccess={() => void reloadHistory()}
      />
    </div>
  );
}
