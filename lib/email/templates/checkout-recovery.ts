import { getEmailBoloesUrl } from "@/lib/email/config";
import { emailFirstName, escapeEmailHtml } from "@/lib/email/recipient";
import {
  emailBodyText,
  emailGreeting,
  emailPrimaryButton,
  emailStrong,
  renderEmailShell,
} from "@/lib/email/templates/email-shell";

export type CheckoutRecoveryEmailParams = { recipientName?: string | null };
type EmailOutput = { subject: string; html: string; text: string };

const FOOTER_NOTE =
  "Você recebeu este e-mail por ter conta no Bolão do Milhão.";

function hi(name?: string | null): string {
  const first = emailFirstName(name);
  return first ? `👋 Olá, ${escapeEmailHtml(first)},` : "👋 Olá,";
}

function shell(subject: string, preheader: string, bodyHtml: string): string {
  const headline = subject.replace(/^[^A-Za-zÀ-ÿ0-9]+/, "").trim() || subject;
  return renderEmailShell({
    preheader,
    headline,
    bodyHtml,
    marketingFooter: true,
    footerNote: FOOTER_NOTE,
  });
}

function txt(first: string | null, subject: string, lines: string[], ctaLabel: string, ctaUrl: string): string {
  const greeting = first ? `Olá, ${first},` : "Olá,";
  return [subject, "", greeting, "", ...lines, "", `${ctaLabel}: ${ctaUrl}`, "", FOOTER_NOTE].join("\n");
}

// ────────────────────────────────────────────────
// EMAIL 01
// ────────────────────────────────────────────────
function buildRecovery1(params: CheckoutRecoveryEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "Você começou, mas não concluiu";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("Percebemos que você iniciou sua compra, mas não concluiu sua participação.")}
    ${emailBodyText(emailStrong("Sua vaga continua disponível."))}
    ${emailPrimaryButton(url, "FINALIZAR COMPRA")}
  `;

  return {
    subject,
    html: shell(subject, "Sua compra não foi concluída. Sua vaga continua disponível.", bodyHtml),
    text: txt(first, subject, [
      "Percebemos que você iniciou sua compra, mas não concluiu sua participação.",
      "Sua vaga continua disponível.",
    ], "FINALIZAR COMPRA", url),
  };
}

// ────────────────────────────────────────────────
// EMAIL 02
// ────────────────────────────────────────────────
function buildRecovery2(params: CheckoutRecoveryEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "Falta só um passo pra sua participação";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("Você chegou muito perto de garantir sua participação.")}
    ${emailBodyText(`Agora falta apenas ${emailStrong("concluir sua compra")}.`)}
    ${emailPrimaryButton(url, "GARANTIR MINHA COTA")}
  `;

  return {
    subject,
    html: shell(subject, "Você chegou perto. Falta só concluir sua compra.", bodyHtml),
    text: txt(first, subject, [
      "Você chegou muito perto de garantir sua participação.",
      "Agora falta apenas concluir sua compra.",
    ], "GARANTIR MINHA COTA", url),
  };
}

// ────────────────────────────────────────────────
// EMAIL 03
// ────────────────────────────────────────────────
function buildRecovery3(params: CheckoutRecoveryEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "R$29,90 pela Copa inteira";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText(
      `Por apenas ${emailStrong("R$29,90")} você participa da Copa inteira e disputa ${emailStrong("mais de R$1 milhão")} em premiações.`,
    )}
    ${emailBodyText("Sua compra ainda pode ser concluída.")}
    ${emailPrimaryButton(url, "FINALIZAR AGORA")}
  `;

  return {
    subject,
    html: shell(subject, "R$29,90 pela Copa inteira. Disputa mais de R$1 milhão.", bodyHtml),
    text: txt(first, subject, [
      "Por apenas R$29,90 você participa da Copa inteira e disputa mais de R$1 milhão em premiações.",
      "Sua compra ainda pode ser concluída.",
    ], "FINALIZAR AGORA", url),
  };
}

export const CHECKOUT_RECOVERY_BUILDERS: Record<
  string,
  (params: CheckoutRecoveryEmailParams) => EmailOutput
> = {
  recovery_1: buildRecovery1,
  recovery_2: buildRecovery2,
  recovery_3: buildRecovery3,
};
