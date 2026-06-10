import { getEmailIndiqueUrl } from "@/lib/email/config";
import { emailFirstName, escapeEmailHtml } from "@/lib/email/recipient";
import {
  emailBodyText,
  emailGreeting,
  emailPrimaryButton,
  emailStrong,
  renderEmailShell,
} from "@/lib/email/templates/email-shell";

export type IndiqueOfertaEmailParams = { recipientName?: string | null };
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
// EMAIL 01 — "Ganhe R$12 por cada amigo indicado"
// ────────────────────────────────────────────────
function buildIndOffer1(params: IndiqueOfertaEmailParams): EmailOutput {
  const url = getEmailIndiqueUrl();
  const subject = "Ganhe R$12 por cada amigo indicado";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("Você já conhece o Bolão do Milhão.")}
    ${emailBodyText("Agora chegou a hora de ganhar indicando seus amigos.")}
    ${emailBodyText("Funciona assim:")}
    ${emailBodyText(
      `✅ Compartilhe seu link<br />
      ✅ Seu amigo se cadastra<br />
      ✅ Você recebe ${emailStrong("R$12 por indicação válida")}`,
    )}
    ${emailBodyText("Quanto mais amigos entrarem, mais você ganha.")}
    ${emailPrimaryButton(url, "PEGAR MEU LINK")}
  `;

  return {
    subject,
    html: shell(subject, "Compartilhe seu link e ganhe R$12 por indicação válida.", bodyHtml),
    text: txt(first, subject, [
      "Você já conhece o Bolão do Milhão.",
      "Agora chegou a hora de ganhar indicando seus amigos.",
      "",
      "Funciona assim:",
      "✅ Compartilhe seu link",
      "✅ Seu amigo se cadastra",
      "✅ Você recebe R$12 por indicação válida",
      "",
      "Quanto mais amigos entrarem, mais você ganha.",
    ], "PEGAR MEU LINK", url),
  };
}

// ────────────────────────────────────────────────
// EMAIL 02 — conta rápida
// ────────────────────────────────────────────────
function buildIndOffer2(params: IndiqueOfertaEmailParams): EmailOutput {
  const url = getEmailIndiqueUrl();
  const subject = "5 amigos = R$60. 50 amigos = R$600.";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("Vamos fazer uma conta rápida.")}
    ${emailBodyText(
      `${emailStrong("5 amigos = R$60")}<br />
      ${emailStrong("10 amigos = R$120")}<br />
      ${emailStrong("25 amigos = R$300")}<br />
      ${emailStrong("50 amigos = R$600")}`,
    )}
    ${emailBodyText("Agora imagine fazer isso antes mesmo da Copa começar.")}
    ${emailBodyText("Seu link já está disponível.")}
    ${emailPrimaryButton(url, "COMPARTILHAR MEU LINK")}
  `;

  return {
    subject,
    html: shell(subject, "5 = R$60, 10 = R$120, 25 = R$300, 50 = R$600. Antes da Copa começar.", bodyHtml),
    text: txt(first, subject, [
      "Vamos fazer uma conta rápida.",
      "5 amigos = R$60",
      "10 amigos = R$120",
      "25 amigos = R$300",
      "50 amigos = R$600",
      "",
      "Agora imagine fazer isso antes mesmo da Copa começar.",
      "Seu link já está disponível.",
    ], "COMPARTILHAR MEU LINK", url),
  };
}

// ────────────────────────────────────────────────
// EMAIL 03 — sem sorteio, sem complicação
// ────────────────────────────────────────────────
function buildIndOffer3(params: IndiqueOfertaEmailParams): EmailOutput {
  const url = getEmailIndiqueUrl();
  const subject = "R$12 por amigo. Sem sorteio, sem complicação.";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("Muita gente já está garantindo sua participação no Bolão do Milhão.")}
    ${emailBodyText("Agora você pode usar suas indicações para ganhar ainda mais.")}
    ${emailBodyText("Cada amigo indicado gera:")}
    ${emailBodyText(`💰 ${emailStrong("R$12")}`)}
    ${emailBodyText(
      `Sem sorteio.<br />
      Sem concurso.<br />
      Sem complicação.`,
    )}
    ${emailPrimaryButton(url, "ACESSAR MEU LINK")}
  `;

  return {
    subject,
    html: shell(subject, "Cada amigo indicado gera R$12. Sem sorteio, sem complicação.", bodyHtml),
    text: txt(first, subject, [
      "Muita gente já está garantindo sua participação no Bolão do Milhão.",
      "Agora você pode usar suas indicações para ganhar ainda mais.",
      "",
      "Cada amigo indicado gera:",
      "💰 R$12",
      "",
      "Sem sorteio.",
      "Sem concurso.",
      "Sem complicação.",
    ], "ACESSAR MEU LINK", url),
  };
}

// ────────────────────────────────────────────────
// EMAIL 04 — "Você está deixando dinheiro na mesa"
// ────────────────────────────────────────────────
function buildIndOffer4(params: IndiqueOfertaEmailParams): EmailOutput {
  const url = getEmailIndiqueUrl();
  const subject = "Você está deixando dinheiro na mesa";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("Enquanto você lê este e-mail, outras pessoas estão compartilhando seus links de indicação.")}
    ${emailBodyText(`Cada novo participante indicado gera ${emailStrong("R$12")}.`)}
    ${emailBodyText("Seu link já está ativo.")}
    ${emailBodyText("Agora é só compartilhar.")}
    ${emailPrimaryButton(url, "PEGAR MEU LINK")}
  `;

  return {
    subject,
    html: shell(subject, "Outras pessoas já estão compartilhando. Cada indicação gera R$12.", bodyHtml),
    text: txt(first, subject, [
      "Enquanto você lê este e-mail, outras pessoas estão compartilhando seus links de indicação.",
      "Cada novo participante indicado gera R$12.",
      "",
      "Seu link já está ativo.",
      "Agora é só compartilhar.",
    ], "PEGAR MEU LINK", url),
  };
}

// ────────────────────────────────────────────────
// EMAIL 05 — combina prêmio + indicação
// ────────────────────────────────────────────────
function buildIndOffer5(params: IndiqueOfertaEmailParams): EmailOutput {
  const url = getEmailIndiqueUrl();
  const subject = "Dispute R$1 milhão e ainda ganhe indicando";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText(
      `Além de disputar ${emailStrong("mais de R$1 milhão")} em premiações durante a Copa, você também pode ganhar indicando amigos.`,
    )}
    ${emailBodyText(`💰 ${emailStrong("R$12 por indicação válida")}`)}
    ${emailBodyText("Quanto mais amigos entrarem, maior será seu ganho.")}
    ${emailPrimaryButton(url, "COMPARTILHAR MEU LINK")}
  `;

  return {
    subject,
    html: shell(subject, "Dispute mais de R$1 milhão na Copa e ganhe R$12 por indicação.", bodyHtml),
    text: txt(first, subject, [
      "Além de disputar mais de R$1 milhão em premiações durante a Copa, você também pode ganhar indicando amigos.",
      "💰 R$12 por indicação válida",
      "",
      "Quanto mais amigos entrarem, maior será seu ganho.",
    ], "COMPARTILHAR MEU LINK", url),
  };
}

// ────────────────────────────────────────────────
// EMAIL 06 — o mais forte
// ────────────────────────────────────────────────
function buildIndOffer6(params: IndiqueOfertaEmailParams): EmailOutput {
  const url = getEmailIndiqueUrl();
  const subject = "10 amigos = R$120 💰";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("Você conhece 10 pessoas que gostam de futebol?")}
    ${emailBodyText("Se a resposta for sim:")}
    ${emailBodyText(
      `${emailStrong("10 amigos = R$120")}<br />
      ${emailStrong("20 amigos = R$240")}<br />
      ${emailStrong("50 amigos = R$600")}<br />
      ${emailStrong("100 amigos = R$1.200")}`,
    )}
    ${emailBodyText("Seu link já está disponível.")}
    ${emailBodyText("Agora é só compartilhar.")}
    ${emailPrimaryButton(url, "ACESSAR MEU LINK DE INDICAÇÃO")}
  `;

  return {
    subject,
    html: shell(subject, "10 amigos = R$120. 100 amigos = R$1.200. Seu link já está pronto.", bodyHtml),
    text: txt(first, subject, [
      "Você conhece 10 pessoas que gostam de futebol?",
      "Se a resposta for sim:",
      "10 amigos = R$120",
      "20 amigos = R$240",
      "50 amigos = R$600",
      "100 amigos = R$1.200",
      "",
      "Seu link já está disponível.",
      "Agora é só compartilhar.",
    ], "ACESSAR MEU LINK DE INDICAÇÃO", url),
  };
}

export const INDIQUE_OFERTA_BUILDERS: Record<
  string,
  (params: IndiqueOfertaEmailParams) => EmailOutput
> = {
  indoffer_1: buildIndOffer1,
  indoffer_2: buildIndOffer2,
  indoffer_3: buildIndOffer3,
  indoffer_4: buildIndOffer4,
  indoffer_5: buildIndOffer5,
  indoffer_6: buildIndOffer6,
};
