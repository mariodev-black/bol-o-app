/**
 * Todas as chamadas HTTP à API Futebol (api.api-futebol.com.br/v1) devem passar por aqui
 * para poder logar no terminal do Node em desenvolvimento/produção.
 *
 * Ative: DEBUG_FOOTBALL_API=1 (ou true/yes). Também respeita DEBUG_MATCHES_SYNC=1.
 */

export function isFootballApiHttpDebugEnabled(): boolean {
  for (const name of ["DEBUG_FOOTBALL_API", "DEBUG_MATCHES_SYNC"]) {
    const raw = (process.env[name] || "").trim().toLowerCase();
    if (raw === "1" || raw === "true" || raw === "yes") return true;
  }
  return false;
}

function pathnameFromUrl(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/** GET/… à API Futebol v1 — logs no stdout do servidor Next/Node. */
export async function fetchFootballApiV1(url: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const debug = isFootballApiHttpDebugEnabled();
  const t0 = Date.now();

  if (debug) {
    console.log(`[api-futebol] → ${method} ${pathnameFromUrl(url)}`);
  }

  const res = await fetch(url, {
    ...init,
    cache: init?.cache ?? "no-store",
  });

  const ms = Date.now() - t0;
  if (debug) {
    const line = `[api-futebol] ← ${method} ${pathnameFromUrl(url)} HTTP ${res.status} ${ms}ms`;
    if (res.ok) {
      console.log(line);
    } else {
      console.warn(line);
      void res
        .clone()
        .text()
        .then((body) => {
          const snip = body.replace(/\s+/g, " ").trim().slice(0, 280);
          if (snip) console.warn(`[api-futebol]   corpo (trunc): ${snip}`);
        })
        .catch(() => {});
    }
  }

  return res;
}
