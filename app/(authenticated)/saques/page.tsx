"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import type { AffiliateSummary } from "../indique/affiliate-types";
import { formatBRLFromCents } from "../indique/affiliate-types";

function parseMoneyToCents(raw: string): number | null {
  const t = raw.trim().replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export default function SaquesPage() {
  const [summary, setSummary] = useState<AffiliateSummary | null>(null);
  const [minCents, setMinCents] = useState(2000);
  const [loading, setLoading] = useState(true);
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

  const available = summary?.balances.availableCents ?? 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const cents = parseMoneyToCents(amountStr);
    if (cents == null) {
      setMessage({ type: "err", text: "Informe um valor válido (ex.: 50,00)." });
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/affiliate/withdraw", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: cents, pixKeyType, pixKey: pixKey.trim() }),
      });
      const d = (await r.json()) as { error?: string; minWithdrawalCents?: number; ok?: boolean };
      if (typeof d.minWithdrawalCents === "number") setMinCents(d.minWithdrawalCents);
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
        Solicite o resgate do saldo de comissões por indicação. O pagamento será feito após aprovação de um administrador.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-white/40 text-sm py-8">
          <Loader2 className="w-4 h-4 animate-spin" />
          Carregando saldo…
        </div>
      ) : (
        <div
          className="rounded-2xl p-5 border border-white/8 mb-6"
          style={{ background: "#101010" }}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/35">Saldo disponível</p>
          <p className="text-3xl font-black text-primary mt-1">{formatBRLFromCents(available)}</p>
          {summary && summary.balances.pendingWithdrawalCents > 0 ? (
            <p className="text-[12px] mt-2 text-white/40">
              Em análise: {formatBRLFromCents(summary.balances.pendingWithdrawalCents)}
            </p>
          ) : null}
          <p className="text-[12px] mt-3 text-white/35">
            Valor mínimo por solicitação: {formatBRLFromCents(minCents)}
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
          <p className="text-[12px] text-white/35 text-center">Saldo abaixo do mínimo para solicitar saque.</p>
        ) : null}
      </form>
    </div>
  );
}
