/**
 * Domínio base do produto (ex.: bolaodomilhao.com.br).
 *
 * Produção:
 * - App (palpites, login, tickets): app.{SITE_DOMAIN}
 * - Vendas (LP, SEO): {SITE_DOMAIN} e www.{SITE_DOMAIN}
 */

const FALLBACK_DOMAIN = "bolaodomilhao.com.br";

function readEnv(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

function hostFromUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeDomain(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

/** Domínio raiz sem `www` (ex.: bolaodomilhao.com.br). */
export function getSiteDomain(): string {
  const explicit = readEnv("SITE_DOMAIN") ?? readEnv("NEXT_PUBLIC_SITE_DOMAIN");
  if (explicit) return normalizeDomain(explicit);

  const marketingHost = hostFromUrl(
    readEnv("MARKETING_URL") ?? readEnv("NEXT_PUBLIC_MARKETING_URL"),
  );
  if (marketingHost) return normalizeDomain(marketingHost);

  const appHost = hostFromUrl(readEnv("APP_URL") ?? readEnv("NEXT_PUBLIC_APP_URL"));
  if (appHost?.startsWith("app.")) return appHost.slice(4);

  return FALLBACK_DOMAIN;
}

/** Hostname do app em produção: app.{domínio}. */
export function getAppHostnameForDomain(domain = getSiteDomain()): string {
  return `app.${domain}`;
}

/** Hostnames da LP: ápex + www (+ www.localhost em dev). */
export function getMarketingHostnames(domain = getSiteDomain()): string[] {
  const hosts = [domain, `www.${domain}`];
  const fromMarketingUrl = hostFromUrl(
    readEnv("MARKETING_URL") ?? readEnv("NEXT_PUBLIC_MARKETING_URL"),
  );
  if (fromMarketingUrl && !hosts.includes(fromMarketingUrl)) {
    hosts.push(fromMarketingUrl);
  }
  const publicMarketing = readEnv("NEXT_PUBLIC_MARKETING_HOST")?.toLowerCase();
  if (publicMarketing && !hosts.includes(publicMarketing)) {
    hosts.push(publicMarketing);
  }
  if (!hosts.includes("www.localhost")) {
    hosts.push("www.localhost");
  }
  return hosts;
}

export function isAppHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  const domain = getSiteDomain();

  if (process.env.LOCAL_DEV_AS_APP === "true" && (h === "localhost" || h === "127.0.0.1")) {
    return true;
  }
  if (h === "app.localhost") return true;
  if (h === getAppHostnameForDomain(domain)) return true;

  const fromAppUrl = hostFromUrl(readEnv("APP_URL") ?? readEnv("NEXT_PUBLIC_APP_URL"));
  if (fromAppUrl && h === fromAppUrl) return true;

  const publicAppHost = readEnv("NEXT_PUBLIC_APP_HOST")?.toLowerCase();
  if (publicAppHost && h === publicAppHost) return true;

  return h === `app.${domain}` || (h.startsWith("app.") && h.endsWith(`.${domain}`));
}

export function isMarketingHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (isAppHostname(h)) return false;
  return getMarketingHostnames().includes(h);
}
