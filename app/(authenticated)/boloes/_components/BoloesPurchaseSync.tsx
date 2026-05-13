"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Após compra/PIX, o App Router pode reutilizar o payload RSC de /boloes.
 * `?fromPurchase=1` dispara um refresh para buscar tickets novos no servidor.
 */
export function BoloesPurchaseSync() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    if (searchParams.get("fromPurchase") !== "1") return;
    done.current = true;
    router.replace("/boloes", { scroll: false });
    router.refresh();
  }, [router, searchParams]);

  return null;
}
