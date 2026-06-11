"use client";

import { Loader2 } from "lucide-react";
import { formatBRLFromCents } from "@/app/(authenticated)/indique/affiliate-types";
import type { UserWithdrawalHistoryItem } from "@/lib/referrals/withdrawHistory";
import {
  balanceSourceLabel,
  formatWithdrawDate,
  pixKeyTypeLabel,
  withdrawStatusMeta,
} from "./withdraw-ui";

type Props = {
  items: UserWithdrawalHistoryItem[];
  loading?: boolean;
  compact?: boolean;
  emptyMessage?: string;
};

export function WithdrawHistoryList({
  items,
  loading = false,
  compact = false,
  emptyMessage = "Nenhum saque solicitado ainda.",
}: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-white/40">
        <Loader2 className="size-4 animate-spin" />
        Carregando histórico…
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="py-6 text-center text-[13px] text-white/35">{emptyMessage}</p>;
  }

  return (
    <ul className={compact ? "space-y-2" : "space-y-3"}>
      {items.map((item) => {
        const status = withdrawStatusMeta(item.status);
        return (
          <li
            key={item.id}
            className={[
              "rounded-xl border border-white/[0.08] bg-black/25",
              compact ? "px-3 py-3" : "px-4 py-4",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-helvetica-now-display text-[16px] font-black tabular-nums text-white">
                  {formatBRLFromCents(item.amountCents)}
                </p>
                <p className="mt-1 text-[11px] text-white/40">{formatWithdrawDate(item.createdAt)}</p>
              </div>
              <span
                className={[
                  "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
                  status.className,
                ].join(" ")}
              >
                {status.label}
              </span>
            </div>

            <div className={compact ? "mt-2.5 grid grid-cols-1 gap-1.5" : "mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2"}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-white/35">Origem</p>
                <p className="mt-0.5 text-[12px] font-semibold text-white/70">{balanceSourceLabel(item.balanceSource)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-white/35">Tipo PIX</p>
                <p className="mt-0.5 text-[12px] font-semibold text-white/70">{pixKeyTypeLabel(item.pixKeyType)}</p>
              </div>
              <div className={compact ? "" : "sm:col-span-2"}>
                <p className="text-[10px] font-black uppercase tracking-wider text-white/35">Chave PIX</p>
                <p className="mt-0.5 break-all font-mono text-[12px] text-white/55">{item.pixKey}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
