/**
 * Código de indicação pendente (visitante ainda não cadastrou).
 * Persistido no domínio público (`/?ref=...`) para não forçar `/cadastrar` na primeira visita.
 * Client-only — não importar em rotas de API/server.
 */

const STORAGE_KEY = "bolao_pending_ref";
const COOKIE_NAME = "bolao_pending_ref";
/** ~90 dias */
const MAX_AGE_SEC = 60 * 60 * 24 * 90;

/** Mesma regra que `normalizeReferralCodeInput` no servidor (sem depender de `pg`). */
export function normalizePendingReferralInput(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (t.length === 0) return null;
  return t.slice(0, 12);
}

export function persistPendingReferralCode(code: string): void {
  if (typeof window === "undefined") return;
  const norm = normalizePendingReferralInput(code);
  if (!norm) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, norm);
  } catch {
    /* quota / private mode */
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(norm)}; Path=/; Max-Age=${MAX_AGE_SEC}; SameSite=Lax${secure}`;
}

/** Lê `?ref=` da query string e grava se válido. */
export function persistPendingReferralFromUrlSearch(search: string): void {
  if (typeof window === "undefined" || !search) return;
  const qs = search.startsWith("?") ? search.slice(1) : search;
  const ref = normalizePendingReferralInput(new URLSearchParams(qs).get("ref"));
  if (ref) persistPendingReferralCode(ref);
}

export function readPendingReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromLs = normalizePendingReferralInput(window.localStorage.getItem(STORAGE_KEY));
    if (fromLs) return fromLs;
  } catch {
    /* */
  }
  const raw = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!raw) return null;
  try {
    return normalizePendingReferralInput(decodeURIComponent(raw));
  } catch {
    return normalizePendingReferralInput(raw);
  }
}

export function clearPendingReferral(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* */
  }
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}
