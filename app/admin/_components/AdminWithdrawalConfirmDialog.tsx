"use client";

import { Loader2, X } from "lucide-react";
import { formatAdminBRL } from "@/lib/admin/format";
import type { AdminWithdrawalRow } from "@/lib/admin/withdrawals";

type Props = {
  open: boolean;
  kind: "approve" | "reject";
  row: AdminWithdrawalRow | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function AdminWithdrawalConfirmDialog({
  open,
  kind,
  row,
  submitting,
  error,
  onClose,
  onConfirm,
}: Props) {
  if (!open || !row) return null;

  const isApprove = kind === "approve";

  return (
    <div
      className="fixed inset-0 z-120 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-withdrawal-dialog-title"
    >
      <div className="relative w-full max-w-[480px] rounded-[22px] border border-white/10 bg-[#080808] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
          aria-label="Fechar"
        >
          <X className="size-4" />
        </button>

        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">
          {isApprove ? "Aprovar saque" : "Recusar saque"}
        </p>
        <h2 id="admin-withdrawal-dialog-title" className="mt-2 pr-10 text-[20px] font-black tracking-[-0.03em] text-white">
          {isApprove ? "Enviar PIX via Cartwave?" : "Estornar saldo ao usuário?"}
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-white/58">
          {isApprove
            ? "O valor será transferido para a chave PIX abaixo. Esta ação não pode ser desfeita automaticamente."
            : "O saldo será devolvido para a conta do usuário e o pedido ficará como recusado."}
        </p>

        <div className="mt-5 space-y-3 rounded-[14px] border border-white/8 bg-white/2.5 p-4 text-[13px]">
          <div className="flex items-start justify-between gap-4">
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/45">Usuário</span>
            <span className="text-right font-bold text-white">
              {row.userName ?? "Sem nome"}
              <span className="mt-1 block text-[12px] font-medium text-white/55">{row.userEmail}</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/45">Valor</span>
            <span className="font-black text-primary">{formatAdminBRL(row.amountCents)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/45">Origem</span>
            <span className="font-bold text-white/80">{row.balanceSource === "wallet" ? "Conta" : "Afiliado"}</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/45">PIX</span>
            <span className="text-right">
              <span className="block text-[11px] font-black uppercase text-white/45">{row.pixKeyType}</span>
              <span className="mt-1 block max-w-[240px] break-all font-mono text-[12px] text-white/80">{row.pixKey}</span>
            </span>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-[13px] font-medium text-red-300">
            {error}
          </p>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-11 rounded-[12px] border border-white/10 bg-white/5 text-[12px] font-black uppercase tracking-[0.12em] text-white/70 hover:bg-white/8 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className={[
              "flex h-11 items-center justify-center gap-2 rounded-[12px] text-[12px] font-black uppercase tracking-[0.12em] disabled:opacity-60",
              isApprove ? "bg-primary text-black" : "border border-red-400/30 bg-red-400/15 text-red-200",
            ].join(" ")}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {isApprove ? "Enviando PIX…" : "Recusando…"}
              </>
            ) : isApprove ? (
              "Confirmar PIX"
            ) : (
              "Confirmar recusa"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
