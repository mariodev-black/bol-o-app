import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Attachment } from "resend";
import { getEmailLogoUrl } from "@/lib/email/config";

/** Referência no HTML: `<img src="cid:bolao-logo" />` — anexo inline no Resend. */
export const EMAIL_LOGO_INLINE_ID = "bolao-logo";

const LOGO_CANDIDATES = [
  "public/email/logo-email.png",
  "public/email/logo.png",
] as const;

export function getEmailLogoFilePath(): string | null {
  for (const rel of LOGO_CANDIDATES) {
    const filePath = join(process.cwd(), rel);
    if (existsSync(filePath)) return filePath;
  }
  return null;
}

/** Anexo inline para Resend (Gmail/Outlook não carregam data: URI). */
export function getEmailLogoAttachmentForResend(): Attachment | null {
  const filePath = getEmailLogoFilePath();
  if (!filePath) return null;

  return {
    content: readFileSync(filePath),
    filename: "logo-email.png",
    contentType: "image/png",
    inlineContentId: EMAIL_LOGO_INLINE_ID,
  };
}

export type EmailLogoDelivery = "inline" | "hosted";

/**
 * Logo no HTML.
 * - `inline` (padrão): `cid:bolao-logo` + anexo em `sendEmail` (Gmail/Outlook).
 * - `hosted`: URL absoluta `{APP_URL}/email/logo-email.png` (preview sem anexo).
 */
export function renderEmailLogoImg(options?: {
  width?: number;
  alt?: string;
  delivery?: EmailLogoDelivery;
}): string {
  const alt = (options?.alt ?? "Bolão do Milhão").replace(/"/g, "&quot;");
  const width = options?.width ?? 220;
  const hasFile = getEmailLogoFilePath() !== null;
  const hostedUrl = getEmailLogoUrl();
  const delivery = options?.delivery ?? "inline";
  const src =
    delivery === "hosted"
      ? hostedUrl
      : hasFile
        ? `cid:${EMAIL_LOGO_INLINE_ID}`
        : hostedUrl;

  if (!src) {
    return `<span style="font-size:18px;font-weight:800;color:#B1EB0B;letter-spacing:0.02em;">Bolão do Milhão</span>`;
  }

  return `<img src="${src}" alt="${alt}" width="${width}" style="display:block;width:${width}px;max-width:100% !important;height:auto !important;margin:0 auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />`;
}
