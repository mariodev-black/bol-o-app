import { getEmailIndiqueUrl } from "@/lib/email/config";
import { emailFirstName, escapeEmailHtml } from "@/lib/email/recipient";
import {
  emailBodyText,
  emailGreeting,
  emailPrimaryButton,
  emailStrong,
  renderEmailShell,
} from "@/lib/email/templates/email-shell";

export type IndiqueEmailParams = { recipientName?: string | null };
type EmailOutput = { subject: string; html: string; text: string };

const FOOTER_NOTE =
  "Você recebeu este e-mail por ter conta ativa no Bolão do Milhão.";

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
function buildIndique1(params: IndiqueEmailParams): EmailOutput {
  const url = getEmailIndiqueUrl();
  const subject = "Ganhe R$12 por cada amigo indicado";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("Sua participação já está garantida.")}
    ${emailBodyText(`Agora você pode ganhar ${emailStrong("R$12 por cada amigo indicado")}.`)}
    ${emailPrimaryButton(url, "PEGAR MEU LINK")}
  `;

  return {
    subject,
    html: shell(subject, "Sua participação está garantida. Agora ganhe R$12 por indicação.", bodyHtml),
    text: txt(first, subject, [
      "Sua participação já está garantida.",
      "Agora você pode ganhar R$12 por cada amigo indicado.",
    ], "PEGAR MEU LINK", url),
  };
}

// ────────────────────────────────────────────────
// EMAIL 02
// ────────────────────────────────────────────────
function buildIndique2(params: IndiqueEmailParams): EmailOutput {
  const url = getEmailIndiqueUrl();
  const subject = "10 amigos = R$120. 25 = R$300. 50 = R$600.";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText(
      `${emailStrong("10 amigos = R$120")}<br />
      ${emailStrong("25 amigos = R$300")}<br />
      ${emailStrong("50 amigos = R$600")}`,
    )}
    ${emailBodyText("Seu link já está disponível.")}
    ${emailPrimaryButton(url, "COMPARTILHAR MEU LINK")}
  `;

  return {
    subject,
    html: shell(subject, "Quanto mais amigos, mais você ganha. Seu link já está pronto.", bodyHtml),
    text: txt(first, subject, [
      "10 amigos = R$120",
      "25 amigos = R$300",
      "50 amigos = R$600",
      "",
      "Seu link já está disponível.",
    ], "COMPARTILHAR MEU LINK", url),
  };
}

// ────────────────────────────────────────────────
// EMAIL 03
// ────────────────────────────────────────────────
function buildIndique3(params: IndiqueEmailParams): EmailOutput {
  const url = getEmailIndiqueUrl();
  const subject = "A Copa é melhor com os amigos juntos";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("A Copa fica ainda melhor quando seus amigos participam junto.")}
    ${emailBodyText(`Além disso, você recebe ${emailStrong("R$12 por indicação válida")}.`)}
    ${emailPrimaryButton(url, "ACESSAR MEU LINK")}
  `;

  return {
    subject,
    html: shell(subject, "Chame os amigos e ganhe R$12 por indicação válida.", bodyHtml),
    text: txt(first, subject, [
      "A Copa fica ainda melhor quando seus amigos participam junto.",
      "Além disso, você recebe R$12 por indicação válida.",
    ], "ACESSAR MEU LINK", url),
  };
}

export const COMPROU_INDIQUE_BUILDERS: Record<
  string,
  (params: IndiqueEmailParams) => EmailOutput
> = {
  indique_1: buildIndique1,
  indique_2: buildIndique2,
  indique_3: buildIndique3,
};
