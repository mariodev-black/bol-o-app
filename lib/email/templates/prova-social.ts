import { getEmailBoloesUrl } from "@/lib/email/config";
import { emailFirstName, escapeEmailHtml } from "@/lib/email/recipient";
import {
  emailBodyText,
  emailGreeting,
  emailPrimaryButton,
  emailStrong,
  renderEmailShell,
} from "@/lib/email/templates/email-shell";

export type ProvaSocialEmailParams = { recipientName?: string | null };
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
function buildProva1(params: ProvaSocialEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "Os bolões gratuitos já começaram a premiar";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("Os bolões gratuitos já começaram a premiar participantes.")}
    ${emailBodyText("Já tivemos ganhadores de:")}
    ${emailBodyText(
      `🥇 ${emailStrong("R$1.000")}<br />
      🥈 ${emailStrong("R$500")}<br />
      🥉 ${emailStrong("R$300")}`,
    )}
    ${emailBodyText("Além de dezenas de cotas gratuitas distribuídas.")}
    ${emailBodyText("Agora chegou a vez da principal disputa da Copa.")}
    ${emailPrimaryButton(url, "GARANTIR MINHA COTA")}
  `;

  return {
    subject,
    html: shell(subject, "Já premiamos R$1.000, R$500, R$300 e dezenas de cotas grátis.", bodyHtml),
    text: txt(first, subject, [
      "Os bolões gratuitos já começaram a premiar participantes.",
      "Já tivemos ganhadores de:",
      "🥇 R$1.000",
      "🥈 R$500",
      "🥉 R$300",
      "Além de dezenas de cotas gratuitas distribuídas.",
      "",
      "Agora chegou a vez da principal disputa da Copa.",
    ], "GARANTIR MINHA COTA", url),
  };
}

// ────────────────────────────────────────────────
// EMAIL 02
// ────────────────────────────────────────────────
function buildProva2(params: ProvaSocialEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "Enquanto uns decidem, outros já ganharam";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("Enquanto muita gente ainda está decidindo...")}
    ${emailBodyText("Outros participantes já ganharam premiações, cotas gratuitas e posições de destaque nos bolões preparatórios.")}
    ${emailBodyText(emailStrong("Agora começa a principal disputa."))}
    ${emailPrimaryButton(url, "ENTRAR AGORA")}
  `;

  return {
    subject,
    html: shell(subject, "Outros já ganharam premiações e cotas. Agora começa a disputa principal.", bodyHtml),
    text: txt(first, subject, [
      "Enquanto muita gente ainda está decidindo...",
      "Outros participantes já ganharam premiações, cotas gratuitas e posições de destaque nos bolões preparatórios.",
      "",
      "Agora começa a principal disputa.",
    ], "ENTRAR AGORA", url),
  };
}

// ────────────────────────────────────────────────
// EMAIL 03
// ────────────────────────────────────────────────
function buildProva3(params: ProvaSocialEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "Quem participa tem chance de ganhar";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("Os bolões preparatórios mostraram uma coisa:")}
    ${emailBodyText(emailStrong("Quem participa tem chance de ganhar."))}
    ${emailBodyText("Já tivemos participantes premiados e novos classificados para o Bolão do Milhão.")}
    ${emailBodyText(emailStrong("Agora é sua vez."))}
    ${emailPrimaryButton(url, "GARANTIR MINHA PARTICIPAÇÃO")}
  `;

  return {
    subject,
    html: shell(subject, "Quem participa tem chance de ganhar. Agora é a sua vez.", bodyHtml),
    text: txt(first, subject, [
      "Os bolões preparatórios mostraram uma coisa:",
      "Quem participa tem chance de ganhar.",
      "Já tivemos participantes premiados e novos classificados para o Bolão do Milhão.",
      "",
      "Agora é sua vez.",
    ], "GARANTIR MINHA PARTICIPAÇÃO", url),
  };
}

// ────────────────────────────────────────────────
// EMAIL 04
// ────────────────────────────────────────────────
function buildProva4(params: ProvaSocialEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "As primeiras premiações já foram liberadas";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("As primeiras premiações já foram liberadas.")}
    ${emailBodyText("Os participantes premiados já estão recebendo seus valores e acessando suas cotas gratuitas.")}
    ${emailBodyText(emailStrong("A Copa ainda nem começou."))}
    ${emailPrimaryButton(url, "GARANTIR MINHA COTA")}
  `;

  return {
    subject,
    html: shell(subject, "As primeiras premiações já saíram. E a Copa ainda nem começou.", bodyHtml),
    text: txt(first, subject, [
      "As primeiras premiações já foram liberadas.",
      "Os participantes premiados já estão recebendo seus valores e acessando suas cotas gratuitas.",
      "",
      "A Copa ainda nem começou.",
    ], "GARANTIR MINHA COTA", url),
  };
}

export const PROVA_SOCIAL_BUILDERS: Record<
  string,
  (params: ProvaSocialEmailParams) => EmailOutput
> = {
  prova_1: buildProva1,
  prova_2: buildProva2,
  prova_3: buildProva3,
  prova_4: buildProva4,
};
