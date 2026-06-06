"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAuth } from "@/app/shared/AuthContext";
import { usePromotionsHub } from "@/app/shared/PromotionsHubContext";
import {
  PROMOTIONS_HUB_QUERY_KEY,
  isPromotionsHubOpenQuery,
} from "@/lib/promotions/hub-public-links";

/**
 * `/?promocoes=1` (ou redirect de `/promocoes`): abre o hub na home e limpa a query.
 */
export function PromotionsHubDeepLink() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, isLoggedIn } = useAuth();
  const { openPromotionsSheet } = usePromotionsHub();
  const handledRef = useRef(false);

  useEffect(() => {
    if (!isPromotionsHubOpenQuery(searchParams)) return;
    if (!ready || !isLoggedIn || handledRef.current) return;

    handledRef.current = true;
    openPromotionsSheet();

    const next = new URLSearchParams(searchParams.toString());
    next.delete(PROMOTIONS_HUB_QUERY_KEY);
    const q = next.toString();
    router.replace(q ? `/?${q}` : "/", { scroll: false });
  }, [ready, isLoggedIn, searchParams, openPromotionsSheet, router]);

  return null;
}
