import { PASSWORD_RESET_CODE_TTL_MINUTES } from "@/lib/email/constants";
import { getEmailAppName } from "@/lib/email/config";
import { emailFirstName } from "@/lib/email/recipient";
import {
  emailAttention,
  emailBodyText,
  emailCodeBlock,
  emailGreeting,
  renderEmailShell,
} from "@/lib/email/templates/email-shell";

export type PasswordResetCodeEmailParams = {
  code: string;
  recipientName?: string | null;
  expiresMinutes?: number;
};

export function buildPasswordResetCodeEmail(params: PasswordResetCodeEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const appName = getEmailAppName();
  const minutes = params.expiresMinutes ?? PASSWORD_RESET_CODE_TTL_MINUTES;
  const first = emailFirstName(params.recipientName);
  const headline = "Código para nova senha";
  const subject = `${headline} — ${appName}`;

  const bodyHtml = `
    ${emailGreeting(first ? `Olá, ${first},` : "Olá,")}
    ${emailBodyText("Use o código abaixo na tela de recuperação de senha.")}
    ${emailBodyText("Por segurança, não compartilhe este código com ninguém.")}
    ${emailCodeBlock(params.code)}
    ${emailAttention(
      `o código expira em ${minutes} minutos. Se você não solicitou a redefinição, ignore este e-mail.`,
    )}
  `;

  const html = renderEmailShell({
    preheader: `${headline}: ${params.code}`,
    headline,
    bodyHtml,
    footerNote: "Recuperação de senha. Não compartilhe o código.",
  });

  const text = [
    subject,
    "",
    first ? `Olá, ${first},` : "Olá,",
    "",
    "Use o código abaixo na tela de recuperação de senha:",
    params.code,
    `Válido por ${minutes} minutos.`,
    "",
    "Se não foi você, ignore este e-mail.",
  ].join("\n");

  return { subject, html, text };
}
