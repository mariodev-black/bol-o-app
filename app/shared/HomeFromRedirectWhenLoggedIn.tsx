"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

function safeReturnPath(from: string | null): string | null {
  if (!from || !from.startsWith("/") || from.startsWith("//")) return null;
  if (from.startsWith("/login") || from.startsWith("/cadastrar")) return null;
  return from;
}

/** Usuário logado que caiu em `/?from=/tickets` (fluxo de compra vindo da home pública). */
export function HomeFromRedirectWhenLoggedIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  useEffect(() => {
    const next = safeReturnPath(from);
    if (!next) return;
    router.replace(next);
  }, [from, router]);

  return null;
}
