import { getEmailAppUrl, getEmailFrom, getEmailReplyTo } from "@/lib/email/config";

/** Extrai o endereço de `Nome <email@dominio>`. */
export function parseFromAddress(from: string): string | null {
  const trimmed = from.trim();
  const angle = trimmed.match(/<([^>]+)>/);
  if (angle?.[1]) return angle[1].trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  return null;
}

/** Remetente para campanhas (evita noreply@ — pior reputação em marketing). */
export function getEmailMarketingFrom(): string | null {
  const raw = (
    process.env.EMAIL_MARKETING_FROM ||
    process.env.EMAIL_FROM ||
    process.env.RESEND_FROM ||
    ""
  ).trim();
  return raw.length > 0 ? raw : null;
}

export function getEmailUnsubscribeAddress(): string {
  const reply = getEmailReplyTo();
  if (reply) return reply.trim().toLowerCase();
  const from = getEmailMarketingFrom() ?? getEmailFrom();
  return from ? (parseFromAddress(from) ?? "contato@bolaodomilhao.com.br") : "contato@bolaodomilhao.com.br";
}

export function getEmailUnsubscribeMailtoUrl(): string {
  const addr = getEmailUnsubscribeAddress();
  const subject = encodeURIComponent("Descadastrar e-mails promocionais");
  const body = encodeURIComponent(
    "Olá, quero deixar de receber e-mails promocionais do Bolão do Milhão.",
  );
  return `mailto:${addr}?subject=${subject}&body=${body}`;
}

export function getEmailPreferencesUrl(): string {
  return getEmailAppUrl("/perfil");
}

/** Headers RFC 2369 — Gmail/Outlook usam para não marcar como spam agressivo. */
export function buildMarketingEmailHeaders(): Record<string, string> {
  const mailto = getEmailUnsubscribeMailtoUrl();
  const prefs = getEmailPreferencesUrl();
  return {
    "List-Unsubscribe": `<${mailto}>, <${prefs}>`,
  };
}

export function getEmailPhysicalAddressLine(): string | null {
  const raw = process.env.EMAIL_PHYSICAL_ADDRESS?.trim();
  return raw && raw.length > 0 ? raw : null;
}

export function getCampaignSendDelayMs(): number {
  const raw = Number.parseInt(
    (process.env.EMAIL_CAMPAIGN_DELAY_MS || "").trim(),
    10,
  );
  if (Number.isFinite(raw) && raw >= 200) return raw;
  return 600;
}
