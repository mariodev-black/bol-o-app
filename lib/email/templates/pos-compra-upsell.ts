import { getEmailBoloesUrl } from "@/lib/email/config";
import { emailFirstName, escapeEmailHtml } from "@/lib/email/recipient";
import {
  emailBodyText,
  emailGreeting,
  emailPrimaryButton,
  emailStrong,
  renderEmailShell,
} from "@/lib/email/templates/email-shell";

export type UpsellEmailParams = { recipientName?: string | null };
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
// EMAIL 01 — 2h
// ────────────────────────────────────────────────
function buildUpsell1(params: UpsellEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "Parabéns! Sua participação está confirmada 🎉";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText(`Sua participação no ${emailStrong("Bolão do Milhão")} foi confirmada.`)}
    ${emailBodyText("Agora deixa eu te contar uma coisa que muita gente não percebe.")}
    ${emailBodyText(`Você pode participar com ${emailStrong("até 8 cotas")}.`)}
    ${emailBodyText("Isso significa mais estratégias, mais possibilidades e mais chances durante toda a Copa.")}
    ${emailPrimaryButton(url, "ADICIONAR MAIS UMA COTA")}
  `;

  return {
    subject,
    html: shell(subject, "Sua participação foi confirmada. Você pode ter até 8 cotas.", bodyHtml),
    text: txt(first, subject, [
      "Sua participação no Bolão do Milhão foi confirmada.",
      "Agora deixa eu te contar uma coisa que muita gente não percebe.",
      "",
      "Você pode participar com até 8 cotas.",
      "Isso significa mais estratégias, mais possibilidades e mais chances durante toda a Copa.",
    ], "ADICIONAR MAIS UMA COTA", url),
  };
}

// ────────────────────────────────────────────────
// EMAIL 02 — 24h
// ────────────────────────────────────────────────
function buildUpsell2(params: UpsellEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "A maioria usa só 1 cota. E você?";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("A maioria dos participantes utiliza apenas uma participação.")}
    ${emailBodyText("Mas alguns estão garantindo mais de uma cota para utilizar estratégias diferentes durante a Copa.")}
    ${emailBodyText(
      `${emailStrong("Mais possibilidades.")}<br />
      ${emailStrong("Mais combinações.")}<br />
      ${emailStrong("Mais oportunidades de pontuar.")}`,
    )}
    ${emailPrimaryButton(url, "GARANTIR MAIS COTAS")}
  `;

  return {
    subject,
    html: shell(subject, "Mais cotas, mais combinações, mais chances de pontuar.", bodyHtml),
    text: txt(first, subject, [
      "A maioria dos participantes utiliza apenas uma participação.",
      "Mas alguns estão garantindo mais de uma cota para utilizar estratégias diferentes durante a Copa.",
      "",
      "Mais possibilidades.",
      "Mais combinações.",
      "Mais oportunidades de pontuar.",
    ], "GARANTIR MAIS COTAS", url),
  };
}

// ────────────────────────────────────────────────
// EMAIL 03 — 48h
// ────────────────────────────────────────────────
function buildUpsell3(params: UpsellEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "Ainda dá tempo de aumentar sua presença na disputa";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("Sua participação já está garantida.")}
    ${emailBodyText("Mas ainda dá tempo de aumentar sua presença na disputa.")}
    ${emailBodyText(`Você pode participar com ${emailStrong("até 8 cotas")}.`)}
    ${emailBodyText("Quanto mais cotas, mais possibilidades durante a Copa.")}
    ${emailPrimaryButton(url, "ADICIONAR PARTICIPAÇÕES")}
  `;

  return {
    subject,
    html: shell(subject, "Aumente sua presença na disputa. Até 8 cotas.", bodyHtml),
    text: txt(first, subject, [
      "Sua participação já está garantida.",
      "Mas ainda dá tempo de aumentar sua presença na disputa.",
      "",
      "Você pode participar com até 8 cotas.",
      "Quanto mais cotas, mais possibilidades durante a Copa.",
    ], "ADICIONAR PARTICIPAÇÕES", url),
  };
}

export const POS_COMPRA_UPSELL_BUILDERS: Record<
  string,
  (params: UpsellEmailParams) => EmailOutput
> = {
  upsell_1: buildUpsell1,
  upsell_2: buildUpsell2,
  upsell_3: buildUpsell3,
};
