"use client";

import { usePathname } from "next/navigation";

/** Painel e fluxo de login/2FA do admin — sem overlays do app participante. */
export function isAdminAppRoute(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function useIsAdminAppRoute(): boolean {
  const pathname = usePathname() ?? "";
  return isAdminAppRoute(pathname);
}
