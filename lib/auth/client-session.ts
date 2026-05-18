import type { AuthUser } from "@/lib/auth/auth-user";

type MeResponse = { user?: AuthUser | null };

let initialSessionPromise: Promise<AuthUser | null> | null = null;

async function fetchMe(): Promise<AuthUser | null> {
  const r = await fetch("/api/auth/me", { credentials: "include" });
  try {
    const data = (await r.json()) as MeResponse;
    return data.user ?? null;
  } catch {
    return null;
  }
}

/** Primeira carga do app: uma única requisição `/me` compartilhada (Strict Mode / remount). */
export function loadInitialSessionUser(): Promise<AuthUser | null> {
  if (!initialSessionPromise) {
    initialSessionPromise = fetchMe();
  }
  return initialSessionPromise;
}

/** Login, logout ou refresh explícito: próximo bootstrap volta a buscar. */
export function resetInitialSessionCache(): void {
  initialSessionPromise = null;
}
