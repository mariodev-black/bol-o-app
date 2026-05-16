"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { persistPendingReferralFromUrlSearch } from "@/lib/referrals/pending-referral-client";

/**
 * Em qualquer rota com `?ref=` na URL, grava o código para uso em cadastro/login/Google.
 */
export function ReferralCapture() {
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  useEffect(() => {
    persistPendingReferralFromUrlSearch(query ? `?${query}` : "");
  }, [query]);

  return null;
}
