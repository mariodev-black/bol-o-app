"use client";

import { Loader2, X } from "lucide-react";
import { formatBRLFromCents } from "@/app/(authenticated)/indique/affiliate-types";
import type { WithdrawalBalanceSource } from "@/lib/referrals/withdrawSource";
import { balanceSourceLabel, pixKeyTypeLabel } from "./withdraw-ui";

type Props = {
  open: boolean;
  amountCents: number;
  balanceSource: WithdrawalBalanceSource;
  pixKeyType: string;
  pixKey: string;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function WithdrawConfirmDialog({
  open,
  amountCents,
  balanceSource,
  pixKeyType,
  pixKey,
  submitting,
  onClose,
  onConfirm,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
        onClick={submitting ? undefined : onClose}
      />
      <div
        className="relative z-[91] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-white/10 p-5 shadow-2xl"
        style={{ background: "#0a0a0a" }}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-primary">Confirmar saque</p>
            <h3 className="text-lg font-black text-white">Revise os dados</h3>
            <p className="mt-1 text-[13px] text-white/45">
              O valor será descontado do seu saldo agora. Se recusado, volta automaticamente.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl p-2 text-white/50 hover:bg-white/10 disabled:opacity-40"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-3 rounded-xl border border-white/8 bg-white/[0.03] p-4 text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-white/40">Valor</span>
            <span className="font-black text-primary">{formatBRLFromCents(amountCents)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-white/40">Origem</span>
            <span className="font-semibold text-white/75">{balanceSourceLabel(balanceSource)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-white/40">Tipo PIX</span>
            <span className="font-semibold text-white/75">{pixKeyTypeLabel(pixKeyType)}</span>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-white/40">Chave PIX</p>
            <p className="mt-1 break-all font-mono text-[12px] text-white/60">{pixKey}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-11 rounded-xl border border-white/10 bg-white/5 text-[12px] font-black uppercase tracking-wide text-white/70 disabled:opacity-40"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-[12px] font-black uppercase tracking-wide text-black disabled:opacity-40"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Enviando…
              </>
            ) : (
              "Confirmar saque"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
