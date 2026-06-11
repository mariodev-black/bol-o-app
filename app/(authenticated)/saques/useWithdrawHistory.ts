"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserWithdrawalHistoryItem } from "@/lib/referrals/withdrawHistory";

export async function fetchWithdrawHistory(limit = 50): Promise<UserWithdrawalHistoryItem[]> {
  const r = await fetch(`/api/affiliate/withdraw/history?limit=${limit}`, { credentials: "include" });
  const d = (await r.json()) as { items?: UserWithdrawalHistoryItem[]; error?: string };
  if (!r.ok) throw new Error(d.error ?? "Falha ao carregar historico");
  return d.items ?? [];
}

export function useWithdrawHistory(limit = 50) {
  const [items, setItems] = useState<UserWithdrawalHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchWithdrawHistory(limit));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, loading, error, reload };
}
