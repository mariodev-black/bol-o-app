"use client";

import { useMemo } from "react";
import { useAppServerConfig } from "@/app/shared/AppServerConfigContext";
import { isAppHostClient, isMarketingHostClient, resolveProductHref } from "@/lib/site-hosts-client";

function isOnMarketingOrigin(marketingOrigin: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.location.origin === marketingOrigin.replace(/\/+$/, "");
  } catch {
    return false;
  }
}

/** Href para bolões, cadastro, tickets — no www/LP usa `APP_URL`; no app mantém path relativo. */
export function useProductHref(path: string): string {
  const { appOrigin, marketingOrigin, subdomainRoutingEnabled, isMarketingRequest } =
    useAppServerConfig();

  const useAppOrigin = useMemo(() => {
    if (!subdomainRoutingEnabled) return false;
    if (isAppHostClient()) return false;
    if (isMarketingRequest) return true;
    return isOnMarketingOrigin(marketingOrigin) || isMarketingHostClient();
  }, [subdomainRoutingEnabled, isMarketingRequest, marketingOrigin]);

  return useMemo(
    () => resolveProductHref(path, appOrigin, useAppOrigin),
    [path, appOrigin, useAppOrigin],
  );
}
