"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Após compra/PIX ou resgate do brinde extra, o App Router pode reutilizar o
 * payload RSC de /boloes. Query flags disparam refresh para buscar tickets novos.
 */
function shouldRefreshBoloesTickets(searchParams: URLSearchParams): boolean {
  return (
    searchParams.get("fromPurchase") === "1" ||
    searchParams.get("fromExtraGift") === "1"
  );
}

export function BoloesPurchaseSync() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (!shouldRefreshBoloesTickets(searchParams)) {
      refreshingRef.current = false;
      return;
    }
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    router.replace("/boloes", { scroll: false });
    router.refresh();
  }, [router, searchParams]);

  return null;
}
