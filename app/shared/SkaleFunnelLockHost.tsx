"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/shared/AuthContext";
import { isSkaleFunnelAllowedPath } from "@/lib/boloes/skale-funnel-shared";

/**
 * Reforço client-side do lock do funil Skale (middleware usa cookie `bolao_skale_locked`).
 */
export function SkaleFunnelLockHost() {
  const { ready, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!ready || !user?.skaleFunnelLocked) return;
    if (isSkaleFunnelAllowedPath(pathname)) return;
    router.replace("/skale");
  }, [ready, user?.skaleFunnelLocked, pathname, router]);

  return null;
}
