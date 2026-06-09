import { getEmailBoloesUrl } from "@/lib/email/config";
import { emailFirstName, escapeEmailHtml } from "@/lib/email/recipient";
import {
  emailBodyText,
  emailGreeting,
  emailPrimaryButton,
  emailStrong,
  renderEmailShell,
} from "@/lib/email/templates/email-shell";

export type PixRecoveryEmailParams = {
  recipientName?: string | null;
};

type EmailOutput = { subject: string; html: string; text: string };

const FOOTER_NOTE =
  "Você recebeu este e-mail por ter conta ativa no Bolão do Milhão.";

function hi(name?: string | null): string {
  const first = emailFirstName(name);
  return first ? `👋 Olá, ${escapeEmailHtml(first)},` : "👋 Olá,";
}

function shell(subject: string, preheader: string, bodyHtml: string): string {
  // Strip leading emoji from H1 — emojis at start of centered H1 wrap to their own line
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
  const greeting = first ? `Olá, ${first} 👋` : "Olá 👋";
  return [subject, "", greeting, "", ...lines, "", `${ctaLabel}: ${ctaUrl}`, "", FOOTER_NOTE].join("\n");
}

// ────────────────────────────────────────────────
// R01 — 15MIN
// ────────────────────────────────────────────────
function buildR01(params: PixRecoveryEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "Seu PIX está aguardando pagamento";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText(
      `Você iniciou sua participação no ${emailStrong("Bolão do Milhão")}, mas o pagamento ainda não foi identificado.`,
    )}
    ${emailBodyText("Sua cota continua reservada por tempo limitado.")}
    ${emailBodyText(
      ` Mais de R$1 milhão em premiações<br />
       Copa inteira<br />
       Apenas R$29,90`,
    )}
    ${emailPrimaryButton(url, "FINALIZAR PAGAMENTO")}
  `;

  return {
    subject,
    html: shell(subject, "Seu PIX foi gerado mas ainda não foi pago. Sua cota está reservada.", bodyHtml),
    text: txt(first, subject, [
      `Você iniciou sua participação no Bolão do Milhão, mas o pagamento ainda não foi identificado.`,
      "Sua cota continua reservada por tempo limitado.",
      "",
      " Mais de R$1 milhão em premiações",
      " Copa inteira",
      " Apenas R$29,90",
    ], "FINALIZAR PAGAMENTO", url),
  };
}

// ────────────────────────────────────────────────
// R02 — 2H
// ────────────────────────────────────────────────
function buildR02(params: PixRecoveryEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "Falta apenas um passo";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("Sua participação está quase confirmada.")}
    ${emailBodyText(
      `O PIX já foi gerado.<br /><br />
      Agora falta apenas ${emailStrong("concluir o pagamento")} para garantir sua vaga na disputa.`,
    )}
    ${emailBodyText("Lembrando: quem estiver participando do Bolão do Milhão poderá concorrer a:")}
    ${emailBodyText(
      ` ${emailStrong("Camisa oficial da Seleção")}<br />
       ${emailStrong("R$1.000 no PIX")}<br />
      acertando o placar exato e os escanteios do Brasil.`,
    )}
    ${emailPrimaryButton(url, "PAGAR AGORA")}
  `;

  return {
    subject,
    html: shell(subject, "Falta um passo. Complete o pagamento e garanta sua vaga na Copa.", bodyHtml),
    text: txt(first, subject, [
      "Sua participação está quase confirmada.",
      "O PIX já foi gerado.",
      "Agora falta apenas concluir o pagamento para garantir sua vaga na disputa.",
      "",
      "Lembrando: quem estiver participando do Bolão do Milhão poderá concorrer a:",
      " Camisa oficial da Seleção",
      " R$1.000 no PIX",
      "acertando o placar exato e os escanteios do Brasil.",
    ], "PAGAR AGORA", url),
  };
}

// ────────────────────────────────────────────────
// R03 — 6H
// ────────────────────────────────────────────────
function buildR03(params: PixRecoveryEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "Você esqueceu sua participação?";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("Percebemos que sua compra ainda não foi concluída.")}
    ${emailBodyText("Sua vaga continua disponível.")}
    ${emailBodyText(
      `Por apenas ${emailStrong("R$29,90")} você participa da Copa inteira.<br /><br />
      Do primeiro jogo até a final.`,
    )}
    ${emailPrimaryButton(url, "CONCLUIR PAGAMENTO")}
  `;

  return {
    subject,
    html: shell(subject, "Sua compra não foi concluída. Vaga ainda disponível por R$29,90.", bodyHtml),
    text: txt(first, subject, [
      "Percebemos que sua compra ainda não foi concluída.",
      "Sua vaga continua disponível.",
      "",
      "Por apenas R$29,90 você participa da Copa inteira.",
      "Do primeiro jogo até a final.",
    ], "CONCLUIR PAGAMENTO", url),
  };
}

// ────────────────────────────────────────────────
// R04 — 12H (EMAIL AGRESSIVO: "E se você acertar?")
// ────────────────────────────────────────────────
function buildR04Agressivo(params: PixRecoveryEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "E se você acertar?";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("Você gerou o PIX.")}
    ${emailBodyText("Mas ainda não confirmou sua participação.")}
    ${emailBodyText("Agora imagina o seguinte:")}
    ${emailBodyText(
      `Brasil entra em campo.<br />
      Você acerta o placar.<br />
      Acerta os escanteios.<br /><br />
      ${emailStrong("Mas não está participando.")}`,
    )}
    ${emailBodyText("Não deixa isso acontecer.")}
    ${emailPrimaryButton(url, "FINALIZAR PAGAMENTO")}
  `;

  return {
    subject,
    html: shell(subject, "E se você acertar o placar do Brasil e os escanteios, mas não tiver participando?", bodyHtml),
    text: txt(first, subject, [
      "Você gerou o PIX.",
      "Mas ainda não confirmou sua participação.",
      "",
      "Agora imagina o seguinte:",
      "",
      "Brasil entra em campo.",
      "Você acerta o placar.",
      "Acerta os escanteios.",
      "",
      "Mas não está participando.",
      "",
      "Não deixa isso acontecer.",
    ], "FINALIZAR PAGAMENTO", url),
  };
}

// ────────────────────────────────────────────────
// R05 — 24H
// ────────────────────────────────────────────────
function buildR05(params: PixRecoveryEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "Sua cota ainda está esperando você";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText(
      `Você chegou até o pagamento.<br />
      Gerou o PIX.<br /><br />
      Mas ainda não finalizou sua participação.`,
    )}
    ${emailBodyText(emailStrong("Não deixe para decidir depois."))}
    ${emailBodyText("A Copa está chegando.")}
    ${emailPrimaryButton(url, "GARANTIR MINHA COTA")}
  `;

  return {
    subject,
    html: shell(subject, "Você chegou até o PIX mas não finalizou. A Copa está chegando.", bodyHtml),
    text: txt(first, subject, [
      "Você chegou até o pagamento.",
      "Gerou o PIX.",
      "",
      "Mas ainda não finalizou sua participação.",
      "",
      "Não deixe para decidir depois.",
      "A Copa está chegando.",
    ], "GARANTIR MINHA COTA", url),
  };
}

// ────────────────────────────────────────────────
// R06 — 36H (EMAIL GANÂNCIA: "R$29,90 ou R$1.000?")
// ────────────────────────────────────────────────
function buildR06Ganancia(params: PixRecoveryEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "R$29,90 ou R$1.000?";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText(
      `Você está deixando uma participação de ${emailStrong("R$29,90")} para depois.`,
    )}
    ${emailBodyText("Mas a mesma participação permite concorrer a:")}
    ${emailBodyText(
      ` ${emailStrong("R$1.000 no PIX")}<br />
       ${emailStrong("Camisa oficial da Seleção Brasileira")}<br />
       Mais de R$1 milhão em premiações durante a Copa`,
    )}
    ${emailPrimaryButton(url, "PAGAR MEU PIX")}
  `;

  return {
    subject,
    html: shell(subject, "R$29,90 para participar. Mas pode virar R$1.000 + camisa oficial.", bodyHtml),
    text: txt(first, subject, [
      "Você está deixando uma participação de R$29,90 para depois.",
      "",
      "Mas a mesma participação permite concorrer a:",
      " R$1.000 no PIX",
      " Camisa oficial da Seleção Brasileira",
      " Mais de R$1 milhão em premiações durante a Copa",
    ], "PAGAR MEU PIX", url),
  };
}

// ────────────────────────────────────────────────
// R07 — 48H
// ────────────────────────────────────────────────
function buildR07(params: PixRecoveryEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "⚠️ Última oportunidade de recuperar sua compra";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("Seu PIX foi gerado, mas ainda não foi pago.")}
    ${emailBodyText(
      `Caso ainda queira participar do ${emailStrong("Bolão do Milhão")}, recomendamos concluir sua participação agora.`,
    )}
    ${emailBodyText(
      ` Mais de R$1 milhão em premiações<br />
       Copa inteira<br />
       Apenas R$29,90`,
    )}
    ${emailPrimaryButton(url, "FINALIZAR PAGAMENTO")}
  `;

  return {
    subject,
    html: shell(subject, "Última oportunidade. PIX gerado mas não pago. Garanta sua participação.", bodyHtml),
    text: txt(first, subject, [
      "Seu PIX foi gerado, mas ainda não foi pago.",
      "",
      "Caso ainda queira participar do Bolão do Milhão, recomendamos concluir sua participação agora.",
      "",
      " Mais de R$1 milhão em premiações",
      " Copa inteira",
      " Apenas R$29,90",
    ], "FINALIZAR PAGAMENTO", url),
  };
}

// ────────────────────────────────────────────────
// R08 — 72H
// ────────────────────────────────────────────────
function buildR08(params: PixRecoveryEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "🇧🇷 Ainda dá tempo de participar";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("A Copa está cada vez mais próxima.")}
    ${emailBodyText("Você ainda pode garantir sua participação.")}
    ${emailBodyText("E continuar concorrendo:")}
    ${emailBodyText(
      ` ${emailStrong("R$1.000 no PIX")}<br />
       ${emailStrong("Camisa oficial da Seleção Brasileira")}`,
    )}
    ${emailPrimaryButton(url, "RECUPERAR MINHA COMPRA")}
  `;

  return {
    subject,
    html: shell(subject, "Ainda dá tempo. Garanta sua participação na Copa.", bodyHtml),
    text: txt(first, subject, [
      "A Copa está cada vez mais próxima.",
      "Você ainda pode garantir sua participação.",
      "",
      "E continuar concorrendo:",
      " R$1.000 no PIX",
      " Camisa oficial da Seleção Brasileira",
    ], "RECUPERAR MINHA COMPRA", url),
  };
}

// ────────────────────────────────────────────────
// Dispatch map
// ────────────────────────────────────────────────
export const PIX_RECOVERY_EMAIL_BUILDERS: Record<
  string,
  (params: PixRecoveryEmailParams) => EmailOutput
> = {
  r01_15min:        buildR01,
  r02_2h:           buildR02,
  r03_6h:           buildR03,
  r04_12h_agressivo: buildR04Agressivo,
  r05_24h:          buildR05,
  r06_36h_ganancia: buildR06Ganancia,
  r07_48h:          buildR07,
  r08_72h:          buildR08,
};
