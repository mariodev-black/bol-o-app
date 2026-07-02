"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Wallet, X } from "lucide-react";
import { formatBRLFromCents } from "@/lib/wallet/format";

/**
 * Confirmação de compra paga com saldo da carteira. Mostra resumo, saldo atual
 * e saldo após a compra, e BLOQUEIA o clique se o saldo não cobrir — impede
 * compra acidental. O servidor revalida o saldo de qualquer forma (fonte da verdade).
 */
export type WalletPurchaseItem = { label: string; qty?: number; cents: number };

export function WalletPurchaseConfirmModal({
  open,
  onClose,
  onConfirm,
  totalCents,
  totalQty,
  items,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  totalCents: number;
  totalQty: number;
  /** Itens reais do pedido (produto + valor). Se ausente, mostra só a quantidade. */
  items?: WalletPurchaseItem[];
  submitting: boolean;
}) {
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/wallet/summary", { credentials: "include", cache: "no-store" });
      const d = (await r.json()) as { balanceCents?: number };
      setBalanceCents(typeof d.balanceCents === "number" ? d.balanceCents : 0);
    } catch {
      setBalanceCents(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
    else setBalanceCents(null);
  }, [open, load]);

  if (!open) return null;

  const balance = balanceCents ?? 0;
  const afterCents = balance - totalCents;
  const insufficient = balanceCents != null && afterCents < 0;
  const ready = balanceCents != null && !loading;

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        className="relative w-full max-w-[420px] overflow-hidden rounded-t-3xl border border-white/10 sm:rounded-3xl"
        style={{ background: "#0c0c0c" }}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <p className="text-[15px] font-black text-white">Confirmar compra</p>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
            aria-label="Fechar"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="px-5 py-5">
          {/* Resumo do pedido */}
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3.5">
            {items && items.length > 0 ? (
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-white/70">
                      {it.qty && it.qty > 1 ? `${it.qty}x ` : ""}
                      {it.label}
                    </span>
                    <span className="shrink-0 text-[13px] font-bold tabular-nums text-white">
                      {formatBRLFromCents(it.cents)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 border-t border-white/8 pt-2">
                  <span className="text-[13px] font-semibold text-white/55">Total</span>
                  <span className="text-[15px] font-black tabular-nums text-white">
                    {formatBRLFromCents(totalCents)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-white/55">
                  {totalQty} {totalQty === 1 ? "cota" : "cotas"}
                </span>
                <span className="text-[15px] font-black tabular-nums text-white">
                  {formatBRLFromCents(totalCents)}
                </span>
              </div>
            )}
          </div>

          {/* Saldos */}
          <div className="mt-3 space-y-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[13px] text-white/55">
                <Wallet className="size-3.5 text-[#B1EB0B]" strokeWidth={2.25} />
                Saldo atual
              </span>
              <span className="text-[14px] font-bold tabular-nums text-white">
                {ready ? formatBRLFromCents(balance) : "…"}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-white/8 pt-2.5">
              <span className="text-[13px] text-white/55">Saldo após a compra</span>
              <span
                className={`text-[14px] font-black tabular-nums ${
                  insufficient ? "text-red-400" : "text-emerald-300"
                }`}
              >
                {ready ? formatBRLFromCents(afterCents) : "…"}
              </span>
            </div>
          </div>

          {insufficient ? (
            <>
              <p className="mt-3 text-center text-[13px] font-semibold text-red-300">
                Saldo insuficiente — faltam {formatBRLFromCents(-afterCents)}.
              </p>
              <Link
                href="/carteira"
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#B1EB0B] text-[15px] font-black uppercase tracking-wide text-[#0E141B] transition active:scale-[0.98]"
              >
                Adicionar saldo
              </Link>
            </>
          ) : (
            <button
              type="button"
              onClick={onConfirm}
              disabled={!ready || submitting}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#B1EB0B] text-[15px] font-black uppercase tracking-wide text-[#0E141B] transition active:scale-[0.98] disabled:opacity-40"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Processando…
                </>
              ) : (
                <>Confirmar e pagar com saldo</>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="mt-2 flex h-11 w-full items-center justify-center rounded-xl text-[14px] font-bold text-white/55 transition hover:text-white disabled:opacity-40"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
