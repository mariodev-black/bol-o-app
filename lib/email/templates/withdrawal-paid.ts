import { getEmailAppName, getEmailAppUrl } from "@/lib/email/config";
import { emailFirstName, escapeEmailHtml } from "@/lib/email/recipient";
import {
  emailBodyText,
  emailGreeting,
  emailPrimaryButton,
  emailStrong,
  renderEmailShell,
} from "@/lib/email/templates/email-shell";

export function buildWithdrawalPaidEmail(input: {
  recipientName?: string | null;
  amountLabel: string;
}): { subject: string; html: string; text: string } {
  const appName = getEmailAppName();
  const saquesUrl = getEmailAppUrl("/saques");
  const first = emailFirstName(input.recipientName);
  const headline = "Saque concluído";
  const subject = `${headline} — ${input.amountLabel}`;

  const bodyHtml = `
    ${emailGreeting(first ? `Olá, ${first},` : "Olá,")}
    ${emailBodyText(
      `Seu saque de ${emailStrong(escapeEmailHtml(input.amountLabel))} foi concluído com sucesso.`,
    )}
    ${emailBodyText(
      "O valor foi enviado via PIX para a chave cadastrada na sua solicitação. Em alguns instantes o crédito deve aparecer na conta de destino.",
    )}
    ${emailPrimaryButton(saquesUrl, "Ver meus saques")}
  `;

  const html = renderEmailShell({
    preheader: `PIX de ${input.amountLabel} enviado com sucesso.`,
    headline,
    bodyHtml,
    footerNote: "E-mail automático do Bolão do Milhão.",
  });

  const text = [
    first ? `Olá, ${first},` : "Olá,",
    "",
    `Seu saque de ${input.amountLabel} foi concluído com sucesso.`,
    "O valor foi enviado via PIX para a chave cadastrada na sua solicitação.",
    "",
    `Acompanhe em: ${saquesUrl}`,
    "",
    appName,
  ].join("\n");

  return { subject, html, text };
}
