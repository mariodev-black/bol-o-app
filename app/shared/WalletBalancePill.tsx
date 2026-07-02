"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Wallet, Plus } from "lucide-react";
import { useAuth } from "@/app/shared/AuthContext";
import { formatBRLFromCents } from "@/lib/wallet/format";

/**
 * Saldo em tempo real: parte do AuthContext e atualiza ao vivo via SSE
 * (`/api/wallet/events`, alimentado pelo LISTEN/NOTIFY do ledger). Sem polling.
 */
function useLiveBalance(userId: string | undefined, seed: number): number {
  const [balance, setBalance] = useState(seed);

  // Acompanha mudanças do contexto (ex.: refresh de sessão).
  useEffect(() => {
    setBalance(seed);
  }, [seed]);

  useEffect(() => {
    if (!userId) return;
    const es = new EventSource("/api/wallet/events");
    es.addEventListener("balance", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as { balanceCents?: number };
        if (typeof data.balanceCents === "number") setBalance(data.balanceCents);
      } catch {
        /* ignore */
      }
    });
    return () => es.close();
  }, [userId]);

  return balance;
}

export function WalletBalancePill({ variant }: { variant: "mobile" | "desktop" }) {
  const { user } = useAuth();
  const liveBalance = useLiveBalance(user?.id, user?.balanceCents ?? 0);
  if (!user) return null;

  const balance = formatBRLFromCents(liveBalance);

  if (variant === "mobile") {
    return (
      <Link
        href="/carteira"
        aria-label={`Carteira — saldo ${balance}`}
        className="flex h-[30px] items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] pl-2.5 pr-2 text-white transition active:scale-[0.97]"
      >
        <Wallet className="size-3.5 shrink-0 text-[#B1EB0B]" strokeWidth={2.25} />
        <span className="text-[12px] font-bold leading-none tabular-nums">{balance}</span>
      </Link>
    );
  }

  return (
    <Link
      href="/carteira"
      aria-label={`Carteira — saldo ${balance}`}
      className="group flex h-[36px] items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.05] pl-3 pr-2 text-white transition hover:border-[#B1EB0B]/40 hover:bg-white/[0.08]"
    >
      <Wallet className="size-4 shrink-0 text-[#B1EB0B]" strokeWidth={2.25} />
      <span className="text-[13px] font-bold leading-none tabular-nums">{balance}</span>
      <span
        className="flex size-5 items-center justify-center rounded-full bg-[#B1EB0B] text-[#0E141B] transition group-hover:scale-105"
        aria-hidden="true"
      >
        <Plus className="size-3.5" strokeWidth={3} />
      </span>
    </Link>
  );
}
