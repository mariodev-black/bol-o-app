"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { ChevronLeft, Copy, Wallet } from "lucide-react";

type TicketType = "general" | "daily";

type DepositTransaction = {
  id: string;
  status: string;
  amountCents: number;
  ticketType: TicketType;
  pixQrcode: string | null;
  createdAt: string;
};

function centsToBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default function DepositoPage() {
  const [prices, setPrices] = useState<{ general: number; daily: number }>({ general: 3990, daily: 2000 });
  const [ticketType, setTicketType] = useState<TicketType>("general");
  const [tx, setTx] = useState<DepositTransaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/deposits/transactions", { credentials: "include" });
        const data = (await r.json()) as { prices?: { general: number; daily: number } };
        if (r.ok && data.prices) setPrices(data.prices);
      } catch {
        // usa fallback local
      }
    })();
  }, []);

  useEffect(() => {
    if (!tx?.id) return;
    if (tx.status !== "waiting_payment" && tx.status !== "pending_payment") return;
    const timer = window.setInterval(async () => {
      try {
        const r = await fetch(`/api/deposits/transactions/${tx.id}`, { credentials: "include", cache: "no-store" });
        const data = (await r.json()) as { transaction?: DepositTransaction };
        if (r.ok && data.transaction) setTx(data.transaction);
      } catch {
        // no-op
      }
    }, 8000);
    return () => window.clearInterval(timer);
  }, [tx?.id, tx?.status]);

  const selectedAmount = useMemo(
    () => (ticketType === "daily" ? prices.daily : prices.general),
    [ticketType, prices.daily, prices.general]
  );

  const createTransaction = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/deposits/transactions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketType }),
      });
      const data = (await r.json()) as { error?: string; transaction?: DepositTransaction };
      if (!r.ok || !data.transaction) {
        setError(data.error ?? "Nao foi possivel criar a transacao.");
        return;
      }
      setTx(data.transaction);
    } catch {
      setError("Erro de rede ao criar deposito.");
    } finally {
      setLoading(false);
    }
  }, [ticketType]);

  const copyPix = useCallback(async () => {
    if (!tx?.pixQrcode) return;
    try {
      await navigator.clipboard.writeText(tx.pixQrcode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // sem fallback
    }
  }, [tx?.pixQrcode]);

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

      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center border"
          style={{
            background: "rgba(177,235,11,0.10)",
            borderColor: "rgba(177,235,11,0.28)",
          }}
          aria-hidden="true"
        >
          <Wallet className="w-5 h-5" style={{ color: "#B1EB0B" }} />
        </div>
        <h1 className="text-[26px] md:text-3xl font-black text-white tracking-tight">Depositar via PIX</h1>
      </div>

      <p className="text-[14px] leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.42)" }}>
        Selecione o tipo do ticket e gere seu PIX no gateway.
      </p>

      <div className="rounded-2xl border p-5 mb-4" style={{ background: "#101010", borderColor: "rgba(255,255,255,0.08)" }}>
        <p className="text-[12px] mb-3" style={{ color: "rgba(255,255,255,0.45)" }}>Tipo de ticket</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTicketType("general")}
            className="h-11 rounded-xl text-[13px] font-bold"
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              background: ticketType === "general" ? "rgba(177,235,11,0.18)" : "rgba(255,255,255,0.04)",
              color: ticketType === "general" ? "#E8FF8A" : "rgba(255,255,255,0.7)",
            }}
          >
            Geral ({centsToBRL(prices.general)})
          </button>
          <button
            type="button"
            onClick={() => setTicketType("daily")}
            className="h-11 rounded-xl text-[13px] font-bold"
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              background: ticketType === "daily" ? "rgba(177,235,11,0.18)" : "rgba(255,255,255,0.04)",
              color: ticketType === "daily" ? "#E8FF8A" : "rgba(255,255,255,0.7)",
            }}
          >
            Diario ({centsToBRL(prices.daily)})
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.5)" }}>Valor</p>
          <p className="text-[20px] font-black text-white">{centsToBRL(selectedAmount)}</p>
        </div>

        <button
          type="button"
          onClick={() => void createTransaction()}
          disabled={loading}
          className="mt-4 w-full h-11 rounded-xl font-black text-[13px] disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, #8FC900, #E8FF8A)",
            color: "#0E141B",
          }}
        >
          {loading ? "Gerando PIX..." : "Gerar PIX"}
        </button>

        {error && (
          <p className="mt-3 text-[12px]" style={{ color: "#FCA5A5" }}>
            {error}
          </p>
        )}
      </div>

      {tx?.pixQrcode && (
        <div className="rounded-2xl border p-5" style={{ background: "#101010", borderColor: "rgba(255,255,255,0.08)" }}>
          <p className="text-[12px] mb-3" style={{ color: "rgba(255,255,255,0.45)" }}>
            Status: <span className="font-semibold text-white">{tx.status}</span>
          </p>
          <div className="bg-white rounded-xl p-3 w-fit mx-auto">
            <QRCode value={tx.pixQrcode} size={176} />
          </div>
          <button
            type="button"
            onClick={() => void copyPix()}
            className="mt-4 w-full h-11 rounded-xl font-bold text-[13px] flex items-center justify-center gap-2"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
          >
            <Copy size={15} />
            {copied ? "Codigo copiado" : "Copiar codigo PIX"}
          </button>
          <p className="mt-3 text-[11px] break-all" style={{ color: "rgba(255,255,255,0.32)" }}>
            {tx.pixQrcode}
          </p>
        </div>
      )}
    </div>
  );
}

