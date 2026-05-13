"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { AffiliateSummary } from "@/app/(authenticated)/indique/affiliate-types";
import type { WithdrawalBalanceSource } from "@/lib/referrals/withdrawSource";
import { formatBRLFromCents } from "@/app/(authenticated)/indique/affiliate-types";

function parseMoneyToCents(raw: string): number | null {
  const t = raw.trim().replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: AffiliateSummary | null;
  summaryLoading: boolean;
  onReloadSummary: () => Promise<void>;
};

export function WithdrawGanhosModal({ open, onOpenChange, summary, summaryLoading, onReloadSummary }: Props) {
  const [balanceSource, setBalanceSource] = useState<WithdrawalBalanceSource>("affiliate");
  const [amountStr, setAmountStr] = useState("");
  const [pixKeyType, setPixKeyType] = useState<"cpf" | "email" | "phone" | "random">("cpf");
  const [pixKey, setPixKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [minCents, setMinCents] = useState(2000);
  const [maxCents, setMaxCents] = useState(50_000_000);

  useEffect(() => {
    if (open && summary) {
      setMinCents(summary.minWithdrawalCents);
      setMaxCents(summary.maxWithdrawalCents ?? 50_000_000);
    }
  }, [open, summary]);

  useEffect(() => {
    if (!open) {
      setAmountStr("");
      setPixKey("");
      setMessage(null);
      setBalanceSource("affiliate");
    }
  }, [open]);

  const affiliateAvail = summary?.balances.availableCents ?? 0;
  const walletAvail = summary?.balances.walletBalanceCents ?? 0;
  const available = balanceSource === "affiliate" ? affiliateAvail : walletAvail;
  const pendingAffiliate = summary?.balances.pendingWithdrawalCents ?? 0;
  const pendingWallet = summary?.balances.pendingWalletWithdrawalCents ?? 0;

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const cents = parseMoneyToCents(amountStr);
    if (cents == null) {
      setMessage({ type: "err", text: "Informe um valor válido (ex.: 50,00)." });
      return;
    }
    if (!Number.isInteger(cents) || cents <= 0) {
      setMessage({ type: "err", text: "Valor inválido." });
      return;
    }
    if (cents < minCents) {
      setMessage({ type: "err", text: `O mínimo é ${formatBRLFromCents(minCents)}.` });
      return;
    }
    if (cents > maxCents) {
      setMessage({ type: "err", text: `O máximo por solicitação é ${formatBRLFromCents(maxCents)}.` });
      return;
    }
    if (cents > available) {
      setMessage({ type: "err", text: "Valor maior que o saldo disponível nesta origem." });
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/affiliate/withdraw", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: cents, pixKeyType, pixKey: pixKey.trim(), balanceSource }),
      });
      const d = (await r.json()) as {
        error?: string;
        minWithdrawalCents?: number;
        maxWithdrawalCents?: number;
        ok?: boolean;
      };
      if (typeof d.minWithdrawalCents === "number") setMinCents(d.minWithdrawalCents);
      if (typeof d.maxWithdrawalCents === "number") setMaxCents(d.maxWithdrawalCents);
      if (!r.ok) {
        setMessage({ type: "err", text: d.error || "Não foi possível enviar o pedido." });
        return;
      }
      setMessage({ type: "ok", text: "Solicitação registrada. Aguarde a análise da equipe." });
      setAmountStr("");
      setPixKey("");
      await onReloadSummary();
    } catch {
      setMessage({ type: "err", text: "Erro de rede. Tente novamente." });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={handleClose}
      />
      <div
        className="relative z-[81] w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10 p-5 sm:p-6 shadow-2xl"
        style={{ background: "#101010" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdraw-modal-title"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-white/80">Saque</p>
            <h2 id="withdraw-modal-title" className="text-xl font-black text-white tracking-tight">
              Solicitar resgate
            </h2>
            <p className="text-[13px] mt-1 text-white/40 leading-snug">
              Escolha a origem do valor. O saldo é reservado na hora; se recusarem, volta automaticamente.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-xl p-2 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {summaryLoading ? (
          <div className="flex items-center gap-2 text-white/40 text-sm py-10 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando saldos…
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-white/8 p-4 mb-4 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">Origem do saque</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBalanceSource("affiliate")}
                  className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                    balanceSource === "affiliate" ? "border-primary bg-primary/10" : "border-white/10 bg-black/20"
                  }`}
                >
                  <p className="text-[12px] font-bold text-white">Saldo afiliado</p>
                  <p className="text-lg font-black text-primary mt-0.5">{formatBRLFromCents(affiliateAvail)}</p>
                  {pendingAffiliate > 0 ? (
                    <p className="text-[11px] text-white/80 mt-1">Em análise: {formatBRLFromCents(pendingAffiliate)}</p>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceSource("wallet")}
                  className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                    balanceSource === "wallet" ? "border-primary bg-primary/10" : "border-white/10 bg-black/20"
                  }`}
                >
                  <p className="text-[12px] font-bold text-white">Saldo conta (bolão / prêmios)</p>
                  <p className="text-lg font-black text-emerald-300 mt-0.5">{formatBRLFromCents(walletAvail)}</p>
                  {pendingWallet > 0 ? (
                    <p className="text-[11px] text-white/80 mt-1">Em análise: {formatBRLFromCents(pendingWallet)}</p>
                  ) : null}
                </button>
              </div>
              <p className="text-[11px] text-white/30">
                Mínimo {formatBRLFromCents(minCents)} · máximo {formatBRLFromCents(maxCents)}
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-white/50 mb-1.5">Valor (R$)</label>
                <input
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="50,00"
                  className="w-full rounded-xl px-4 py-3 bg-black/30 border border-white/10 text-white text-[15px]"
                  inputMode="decimal"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-white/50 mb-1.5">Tipo da chave PIX</label>
                <select
                  value={pixKeyType}
                  onChange={(e) => setPixKeyType(e.target.value as typeof pixKeyType)}
                  className="w-full rounded-xl px-4 py-3 bg-black/30 border border-white/10 text-white text-[15px]"
                  disabled={submitting}
                >
                  <option value="cpf">CPF</option>
                  <option value="email">E-mail</option>
                  <option value="phone">Telefone</option>
                  <option value="random">Chave aleatória</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-white/50 mb-1.5">Chave PIX</label>
                <input
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="Digite a chave"
                  className="w-full rounded-xl px-4 py-3 bg-black/30 border border-white/10 text-white text-[15px]"
                  disabled={submitting}
                />
              </div>
              {message ? (
                <p className={`text-sm ${message.type === "ok" ? "text-emerald-400" : "text-red-300"}`}>{message.text}</p>
              ) : null}
              <button
                type="submit"
                disabled={submitting || available < minCents}
                className="w-full py-3.5 rounded-xl font-black text-[15px] bg-gradient-to-r from-[#8FC900] to-primary text-black disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Solicitar saque
              </button>
              {available < minCents ? (
                <p className="text-[12px] text-white/80 text-center">Saldo desta origem abaixo do mínimo.</p>
              ) : null}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
