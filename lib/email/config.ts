import { getAppOrigin, SITE_NAME } from "@/lib/seo/config";

/** Remetente Resend — ex.: `Bolão do Milhão <noreply@seudominio.com.br>` */
export function getEmailFrom(): string | null {
  const raw = (process.env.EMAIL_FROM || process.env.RESEND_FROM || "").trim();
  return raw.length > 0 ? raw : null;
}

export function getEmailReplyTo(): string | undefined {
  const raw = process.env.EMAIL_REPLY_TO?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

export function getEmailAppName(): string {
  return process.env.SMS_APP_NAME?.trim() || SITE_NAME;
}

/** Logo para e-mail (PNG ~240px) — servido em `/email/logo-email.png`. */
export function getEmailLogoUrl(): string {
  return `${getAppOrigin()}/email/logo-email.png`;
}

export function getEmailAppUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getAppOrigin()}${normalized}`;
}

export function getEmailLoginUrl(): string {
  return getEmailAppUrl("/login");
}

export function getEmailBoloesUrl(): string {
  return getEmailAppUrl("/boloes");
}

export function getEmailPalpitesUrl(): string {
  return getEmailAppUrl("/palpites");
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && getEmailFrom());
}
