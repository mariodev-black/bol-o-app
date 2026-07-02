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
  const combinedAvail = summary?.balances.combinedAvailableCents ?? affiliateAvail + walletAvail;
  const pendingCombined = summary?.balances.combinedPendingCents ?? 0;
  const minCents = summary?.minWithdrawalCents ?? 2000;

  return (
    <div className="flex flex-1 flex-col px-4 sm:px-6 py-6 md:py-8 max-w-lg md:max-w-2xl mx-auto w-full pb-24">
      <Link
        href="/carteira"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold mb-6 w-fit transition-opacity hover:opacity-80"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        <ChevronLeft className="w-4 h-4" />
        Voltar para a carteira
      </Link>

      <h1 className="text-[26px] md:text-3xl font-black text-white tracking-tight mb-2">Sacar ganhos</h1>
      <p className="text-[14px] leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.42)" }}>
        Solicite o resgate do seu saldo (carteira + comissões de afiliado). O valor é descontado na hora e fica em
        análise até a equipe aprovar ou recusar.
      </p>

      <section className="rounded-2xl border border-white/8 p-5 mb-6" style={{ background: "#101010" }}>
        {loading ? (
          <div className="flex items-center gap-2 text-white/40 text-sm py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando saldo…
          </div>
        ) : (
          <>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/80 mb-2">Saldo disponível</p>
            <p className="text-3xl font-black text-primary">{formatBRLFromCents(combinedAvail)}</p>
            {(affiliateAvail > 0 || walletAvail > 0) ? (
              <p className="mt-1.5 text-[12px] text-white/45">
                Inclui {formatBRLFromCents(affiliateAvail)} de afiliado
                {walletAvail > 0 ? ` + ${formatBRLFromCents(walletAvail)} da carteira` : ""}
              </p>
            ) : null}
            {pendingCombined > 0 ? (
              <p className="mt-2 text-[12px] text-white/40">Em análise: {formatBRLFromCents(pendingCombined)}</p>
            ) : null}
            <p className="mt-3 text-[12px] text-white/35">
              Mínimo por solicitação: {formatBRLFromCents(minCents)}
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              disabled={loading || combinedAvail < minCents}
              className="mt-4 flex h-12 w-full items-center justify-center gap-1 rounded-xl bg-primary font-black text-[15px] uppercase tracking-wide text-black disabled:opacity-40"
            >
              Solicitar saque
              <ChevronRight className="size-4" strokeWidth={2.6} />
            </button>
            {combinedAvail < minCents ? (
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
