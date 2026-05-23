import { getEmailAppUrl } from "@/lib/email/config";
import { getAppOrigin } from "@/lib/seo/config";

/** Caminho relativo ou URL absoluta do app → link absoluto para o e-mail. */
export function resolveAdminBroadcastButtonUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return getEmailAppUrl("/palpites");

  if (trimmed.startsWith("/")) {
    return getEmailAppUrl(trimmed);
  }

  const origin = getAppOrigin().replace(/\/$/, "");
  if (trimmed.startsWith(origin)) {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return getEmailAppUrl(`/${trimmed.replace(/^\//, "")}`);
}

export function isAllowedAdminBroadcastButtonUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed.length <= 500;
  }
  try {
    const resolved = new URL(
      trimmed.startsWith("http") ? trimmed : `https://${trimmed}`,
    );
    if (!["http:", "https:"].includes(resolved.protocol)) return false;
    return resolved.href.length <= 500;
  } catch {
    return false;
  }
}
