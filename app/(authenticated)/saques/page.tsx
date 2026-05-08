"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import type { AffiliateSummary } from "../indique/affiliate-types";
import { formatBRLFromCents } from "../indique/affiliate-types";
import type { WithdrawalBalanceSource } from "@/lib/referrals/withdrawSource";

function parseMoneyToCents(raw: string): number | null {
  const t = raw.trim().replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export default function SaquesPage() {
  const [summary, setSummary] = useState<AffiliateSummary | null>(null);
  const [minCents, setMinCents] = useState(2000);
  const [maxCents, setMaxCents] = useState(50_000_000);
  const [loading, setLoading] = useState(true);
  const [balanceSource, setBalanceSource] = useState<WithdrawalBalanceSource>("affiliate");
  const [amountStr, setAmountStr] = useState("");
  const [pixKeyType, setPixKeyType] = useState<"cpf" | "email" | "phone" | "random">("cpf");
  const [pixKey, setPixKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/affiliate/summary", { credentials: "include", cache: "no-store" });
      const d = (await r.json()) as { summary?: AffiliateSummary };
      if (r.ok && d.summary) {
        setSummary(d.summary);
        setMinCents(d.summary.minWithdrawalCents);
        setMaxCents(d.summary.maxWithdrawalCents ?? 50_000_000);
      } else setSummary(null);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const affiliateAvail = summary?.balances.availableCents ?? 0;
  const walletAvail = summary?.balances.walletBalanceCents ?? 0;
  const available = balanceSource === "affiliate" ? affiliateAvail : walletAvail;
  const pendingAffiliate = summary?.balances.pendingWithdrawalCents ?? 0;
  const pendingWallet = summary?.balances.pendingWalletWithdrawalCents ?? 0;

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
      await load();
    } catch {
      setMessage({ type: "err", text: "Erro de rede. Tente novamente." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col px-4 sm:px-6 py-6 md:py-8 max-w-lg md:max-w-2xl mx-auto w-full">
      <Link
        href="/indique"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold mb-6 w-fit transition-opacity hover:opacity-80"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        <ChevronLeft className="w-4 h-4" />
        Voltar para indicações
      </Link>

      <h1 className="text-[26px] md:text-3xl font-black text-white tracking-tight mb-2">
        Sacar ganhos
      </h1>
      <p className="text-[14px] leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.42)" }}>
        Escolha se o valor sai do saldo de comissões (afiliado) ou do saldo da conta (bolão / prêmios). O valor fica
        reservado até a equipe aprovar ou recusar — se recusarem, o saldo volta automaticamente.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-white/40 text-sm py-8">
          <Loader2 className="w-4 h-4 animate-spin" />
          Carregando saldo…
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/35">Origem do saque</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setBalanceSource("affiliate")}
              className={`rounded-2xl p-4 border text-left transition-colors ${
                balanceSource === "affiliate" ? "border-primary bg-primary/10" : "border-white/8 bg-[#101010]"
              }`}
            >
              <p className="text-[12px] font-semibold text-white/50">Saldo afiliado</p>
              <p className="text-2xl font-black text-primary mt-1">{formatBRLFromCents(affiliateAvail)}</p>
              {pendingAffiliate > 0 ? (
                <p className="text-[12px] mt-2 text-white/40">Em análise: {formatBRLFromCents(pendingAffiliate)}</p>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setBalanceSource("wallet")}
              className={`rounded-2xl p-4 border text-left transition-colors ${
                balanceSource === "wallet" ? "border-primary bg-primary/10" : "border-white/8 bg-[#101010]"
              }`}
            >
              <p className="text-[12px] font-semibold text-white/50">Saldo conta</p>
              <p className="text-2xl font-black text-emerald-300 mt-1">{formatBRLFromCents(walletAvail)}</p>
              {pendingWallet > 0 ? (
                <p className="text-[12px] mt-2 text-white/40">Em análise: {formatBRLFromCents(pendingWallet)}</p>
              ) : null}
            </button>
          </div>
          <p className="text-[12px] text-white/35">
            Mínimo por solicitação: {formatBRLFromCents(minCents)} · máximo: {formatBRLFromCents(maxCents)}
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} className="rounded-2xl p-6 border border-white/8 space-y-4" style={{ background: "#101010" }}>
        <div>
          <label className="block text-[12px] font-semibold text-white/50 mb-1.5">Valor (R$)</label>
          <input
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="50,00"
            className="w-full rounded-xl px-4 py-3 bg-black/30 border border-white/10 text-white text-[15px]"
            inputMode="decimal"
            disabled={submitting || loading}
          />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-white/50 mb-1.5">Tipo da chave PIX</label>
          <select
            value={pixKeyType}
            onChange={(e) => setPixKeyType(e.target.value as typeof pixKeyType)}
            className="w-full rounded-xl px-4 py-3 bg-black/30 border border-white/10 text-white text-[15px]"
            disabled={submitting || loading}
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
            disabled={submitting || loading}
          />
        </div>
        {message ? (
          <p className={`text-sm ${message.type === "ok" ? "text-emerald-400" : "text-red-300"}`}>{message.text}</p>
        ) : null}
        <button
          type="submit"
          disabled={submitting || loading || available < minCents}
          className="w-full py-3.5 rounded-xl font-black text-[15px] bg-gradient-to-r from-[#8FC900] to-primary text-black disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Solicitar saque
        </button>
        {available < minCents && !loading ? (
          <p className="text-[12px] text-white/35 text-center">Saldo desta origem abaixo do mínimo para solicitar saque.</p>
        ) : null}
      </form>
    </div>
  );
}
