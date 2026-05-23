import { getEmailAppName } from "@/lib/email/config";
import { resolveAdminBroadcastButtonUrl } from "@/lib/email/resolve-button-url";
import { emailFirstName, escapeEmailHtml } from "@/lib/email/recipient";
import {
  emailBodyText,
  emailGreeting,
  emailPrimaryButton,
  renderEmailShell,
} from "@/lib/email/templates/email-shell";

export type AdminBroadcastEmailButton = {
  label: string;
  url: string;
};

export type AdminBroadcastEmailParams = {
  recipientName?: string | null;
  title: string;
  preview: string;
  body: string;
  /** Omita ou null para e-mail só com texto, sem CTA. */
  button?: AdminBroadcastEmailButton | null;
};

function bodyToHtmlParagraphs(text: string): string {
  const blocks = text
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (blocks.length === 0) {
    return emailBodyText(escapeEmailHtml(text.trim() || " "));
  }
  return blocks
    .map((block) =>
      emailBodyText(
        escapeEmailHtml(block).replace(/\n/g, "<br />"),
      ),
    )
    .join("");
}

export function buildAdminBroadcastEmail(
  params: AdminBroadcastEmailParams,
): { subject: string; html: string; text: string } {
  const appName = getEmailAppName();
  const first = emailFirstName(params.recipientName);
  const headline = params.title.trim();
  const subject = headline.includes(appName) ? headline : `${headline} — ${appName}`;

  const buttonBlock =
    params.button?.label?.trim() && params.button?.url?.trim()
      ? (() => {
          const buttonHref = resolveAdminBroadcastButtonUrl(params.button!.url);
          const buttonLabel = params.button!.label.trim();
          return {
            html: emailPrimaryButton(buttonHref, buttonLabel),
            text: [`${buttonLabel}: ${buttonHref}`, ""],
          };
        })()
      : { html: "", text: [] as string[] };

  const bodyHtml = `
    ${emailGreeting(first ? `Olá, ${escapeEmailHtml(first)},` : "Olá,")}
    ${bodyToHtmlParagraphs(params.body)}
    ${buttonBlock.html}
  `;

  const text = [
    first ? `Olá, ${first},` : "Olá,",
    "",
    params.body.trim(),
    "",
    ...buttonBlock.text,
    "Você recebeu este e-mail por ter conta ativa no Bolão do Milhão.",
    "",
    appName,
  ].join("\n");

  const html = renderEmailShell({
    preheader: params.preview.trim(),
    headline,
    bodyHtml,
    marketingFooter: true,
    footerNote:
      "Você recebeu este e-mail por ter conta ativa no Bolão do Milhão.",
  });

  return { subject, html, text };
}
