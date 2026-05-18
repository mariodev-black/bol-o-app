import type { NextRequest } from "next/server";

/** Valor bruto de `x-forwarded-host` ou `host` (pode incluir porta). */
export function forwardingHostRaw(request: NextRequest): string {
  const xfh = request.headers.get("x-forwarded-host");
  if (xfh) return xfh.split(",")[0]?.trim() ?? "";
  return request.headers.get("host")?.trim() ?? "";
}

/** Hostname em minúsculas, sem porta IPv4; IPv6 sem colchetes na comparação. */
export function parseHostnameFromHostHeader(raw: string): string {
  if (!raw) return "";
  const host = raw.split(",")[0]?.trim() ?? "";
  if (!host) return "";
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    if (end !== -1) return host.slice(1, end).toLowerCase();
  }
  const lastColon = host.lastIndexOf(":");
  if (lastColon > 0) {
    const maybePort = host.slice(lastColon + 1);
    if (/^\d+$/.test(maybePort)) return host.slice(0, lastColon).toLowerCase();
  }
  return host.toLowerCase();
}

export function canonicalHostname(request: NextRequest): string {
  return parseHostnameFromHostHeader(forwardingHostRaw(request));
}

/** Domínio compartilhável para cookie em produção (www + ápex). */
export function productionSessionCookieDomain(hostname: string): string | undefined {
  if (hostname === "bolaodomilhao.com.br" || hostname.endsWith(".bolaodomilhao.com.br")) {
    return ".bolaodomilhao.com.br";
  }
  return undefined;
}

/**
 * Origem pública (scheme + host [+ porta em dev]) para OAuth e redirects.
 * Evita mismatch www/ápex quando APP_URL difere do host que o usuário usou.
 */
export function getOAuthPublicOrigin(request: NextRequest): string {
  const hostRaw = forwardingHostRaw(request);
  const hostname = canonicalHostname(request);
  const xfProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const isHttps =
    xfProto === "https" || (request.nextUrl.protocol === "https:" && xfProto !== "http");

  const prodHttps = (h: string) => `https://${h}`;

  if (hostname === "bolaodomilhao.com.br" || hostname === "www.bolaodomilhao.com.br") {
    return prodHttps(hostname);
  }
  if (hostname.endsWith(".bolaodomilhao.com.br")) {
    return prodHttps(hostname);
  }

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    const proto = isHttps ? "https" : "http";
    return `${proto}://${hostRaw}`;
  }

  const appBase = process.env.APP_URL?.replace(/\/$/, "") ?? "";
  if (appBase && hostname) {
    try {
      const appHost = new URL(appBase).hostname.toLowerCase();
      const root = (s: string) => s.replace(/^www\./, "");
      if (root(hostname) === root(appHost)) {
        const proto = isHttps ? "https" : "http";
        return `${proto}://${hostRaw}`;
      }
    } catch {
      /* ignore */
    }
  }

  return request.nextUrl.origin.replace(/\/$/, "");
}
