"use client";

import { useCallback, useEffect, useState } from "react";
import { usePromotionsHub } from "@/app/shared/PromotionsHubContext";
import type { BrasilMarrocosPlacarPromoStatus } from "@/lib/promotions/brasil-marrocos-placar-promo-shared";

export const BRASIL_MARROCOS_PLACAR_API = "/api/promotions/brasil-marrocos-placar";

/** Cache curto no client — evita rajadas entre Host, hub e páginas da promo. */
const CLIENT_STALE_MS = 45_000;

let memoryCache: BrasilMarrocosPlacarPromoStatus | null = null;
let memoryCachedAt = 0;
let inflight: Promise<BrasilMarrocosPlacarPromoStatus | null> | null = null;

function isFresh(): boolean {
  return memoryCache != null && Date.now() - memoryCachedAt < CLIENT_STALE_MS;
}

export function peekBrasilMarrocosPlacarPromoStatus(): BrasilMarrocosPlacarPromoStatus | null {
  return isFresh() ? memoryCache : null;
}

export function seedBrasilMarrocosPlacarPromoStatus(
  data: BrasilMarrocosPlacarPromoStatus,
): void {
  memoryCache = data;
  memoryCachedAt = Date.now();
}

export function invalidateBrasilMarrocosPlacarPromoStatusCache(): void {
  memoryCache = null;
  memoryCachedAt = 0;
}

export async function fetchBrasilMarrocosPlacarPromoStatus(opts?: {
  force?: boolean;
}): Promise<BrasilMarrocosPlacarPromoStatus | null> {
  if (!opts?.force && isFresh()) {
    return memoryCache;
  }
  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    try {
      const r = await fetch(BRASIL_MARROCOS_PLACAR_API, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) {
        return isFresh() ? memoryCache : null;
      }
      const data = (await r.json()) as BrasilMarrocosPlacarPromoStatus;
      memoryCache = data;
      memoryCachedAt = Date.now();
      return data;
    } catch {
      return isFresh() ? memoryCache : null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

type UseBrasilMarrocosPromoOptions = {
  /** Refetch em background mesmo com cache fresco (default: true). */
  revalidate?: boolean;
};

export function useBrasilMarrocosPlacarPromoStatus(
  options: UseBrasilMarrocosPromoOptions = {},
) {
  const revalidate = options.revalidate !== false;
  const { getPromotionPrefetch, setPromotionPrefetch } = usePromotionsHub();

  const [status, setStatus] = useState<BrasilMarrocosPlacarPromoStatus | null>(
    () => {
      const prefetch = getPromotionPrefetch("brasil_marrocos_placar") as
        | BrasilMarrocosPlacarPromoStatus
        | undefined;
      if (prefetch?.enabled) {
        seedBrasilMarrocosPlacarPromoStatus(prefetch);
        return prefetch;
      }
      return peekBrasilMarrocosPlacarPromoStatus();
    },
  );
  const [loading, setLoading] = useState(() => status == null);

  const apply = useCallback(
    (data: BrasilMarrocosPlacarPromoStatus) => {
      seedBrasilMarrocosPlacarPromoStatus(data);
      setPromotionPrefetch("brasil_marrocos_placar", data);
      setStatus(data);
      setLoading(false);
    },
    [setPromotionPrefetch],
  );

  useEffect(() => {
    let cancelled = false;
    const hadCache = status != null;

    if (hadCache) {
      setLoading(false);
    }

    if (!revalidate && hadCache) {
      return;
    }

    void fetchBrasilMarrocosPlacarPromoStatus({ force: !hadCache }).then(
      (data) => {
        if (cancelled) return;
        if (data) {
          apply(data);
        } else if (!hadCache) {
          setLoading(false);
        }
      },
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cache inicial via useState
  }, [apply, revalidate]);

  const refresh = useCallback(async () => {
    invalidateBrasilMarrocosPlacarPromoStatusCache();
    const data = await fetchBrasilMarrocosPlacarPromoStatus({ force: true });
    if (data) apply(data);
    return data;
  }, [apply]);

  return { status, loading, refresh };
}
