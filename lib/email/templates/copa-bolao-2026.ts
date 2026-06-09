import { getEmailBoloesUrl } from "@/lib/email/config";
import { emailFirstName, escapeEmailHtml } from "@/lib/email/recipient";
import {
  emailBodyText,
  emailGreeting,
  emailPrimaryButton,
  emailStrong,
  renderEmailShell,
} from "@/lib/email/templates/email-shell";

export type CopaEmailParams = {
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

function textLines(first: string | null, subject: string, lines: string[], ctaLabel: string, ctaUrl: string): string {
  const greeting = first ? `Olá, ${first} 👋` : "Olá 👋";
  return [subject, "", greeting, "", ...lines, "", `${ctaLabel}: ${ctaUrl}`, "", FOOTER_NOTE].join("\n");
}

// ────────────────────────────────────────────────
// TERÇA 09H
// ────────────────────────────────────────────────
function buildTer09h(params: CopaEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = " Mais de R$ 1 milhão em premiações por apenas R$29,90";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText(
      `Você já conhece a plataforma.<br />
      Já participou dos bolões gratuitos.<br /><br />
      Agora chegou a hora da principal disputa da Copa.`,
    )}
    ${emailBodyText(
      ` Mais de R$ 1 milhão em premiações<br />
       Copa inteira<br />
       Apenas R$29,90`,
    )}
    ${emailBodyText(`Além disso, quem acertar o placar exato e os escanteios do Brasil ganha:`)}
    ${emailBodyText(
      ` ${emailStrong("Camisa oficial da Seleção")}<br />
       ${emailStrong("R$1.000 no PIX")}`,
    )}
    ${emailPrimaryButton(url, "GARANTIR MINHA COTA")}
  `;

  return {
    subject,
    html: shell(subject, "Copa inteira. Mais de R$1 milhão em premiações. Por apenas R$29,90.", bodyHtml),
    text: textLines(first, subject, [
      "Você já conhece a plataforma.",
      "Já participou dos bolões gratuitos.",
      "",
      "Agora chegou a hora da principal disputa da Copa.",
      "",
      " Mais de R$ 1 milhão em premiações",
      " Copa inteira",
      " Apenas R$29,90",
      "",
      "Além disso, quem acertar o placar exato e os escanteios do Brasil ganha:",
      " Camisa oficial da Seleção",
      " R$1.000 no PIX",
    ], "GARANTIR MINHA COTA", url),
  };
}

// ────────────────────────────────────────────────
// TERÇA 12H
// ────────────────────────────────────────────────
function buildTer12h(params: CopaEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "🇧🇷 R$29,90 pode virar R$1.000 + uma camisa oficial";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("Imagine acertar:")}
    ${emailBodyText(
      ` placar exato do Brasil<br />
       número de escanteios`,
    )}
    ${emailBodyText("e receber:")}
    ${emailBodyText(
      ` ${emailStrong("R$1.000 no PIX")}<br />
       ${emailStrong("Camisa oficial da Seleção Brasileira")}`,
    )}
    ${emailBodyText(
      `Mas atenção: a promoção é exclusiva para participantes do ${emailStrong("Bolão do Milhão")}.`,
    )}
    ${emailPrimaryButton(url, "GARANTIR MINHA PARTICIPAÇÃO")}
  `;

  return {
    subject,
    html: shell(subject, "Acerte o placar do Brasil e os escanteios. Ganhe R$1.000 + camisa oficial.", bodyHtml),
    text: textLines(first, subject, [
      "Imagine acertar:",
      " placar exato do Brasil",
      " número de escanteios",
      "",
      "e receber:",
      " R$1.000 no PIX",
      " Camisa oficial da Seleção Brasileira",
      "",
      "Mas atenção: a promoção é exclusiva para participantes do Bolão do Milhão.",
    ], "GARANTIR MINHA PARTICIPAÇÃO", url),
  };
}

// ────────────────────────────────────────────────
// TERÇA 16H
// ────────────────────────────────────────────────
function buildTer16h(params: CopaEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "👀 Você vai usar apenas uma cota?";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("Uma informação importante:")}
    ${emailBodyText(`Você pode participar com ${emailStrong("até 8 cotas")}.`)}
    ${emailBodyText(
      `Muitos participantes utilizam mais de uma participação para testar
      estratégias diferentes durante a Copa.`,
    )}
    ${emailBodyText(
      `Mais possibilidades.<br />
      Mais combinações.<br />
      Mais chances de pontuar.`,
    )}
    ${emailPrimaryButton(url, "GARANTIR MINHAS COTAS")}
  `;

  return {
    subject,
    html: shell(subject, "Você pode participar com até 8 cotas. Mais chances de pontuar.", bodyHtml),
    text: textLines(first, subject, [
      "Uma informação importante:",
      "Você pode participar com até 8 cotas.",
      "",
      "Muitos participantes utilizam mais de uma participação para testar",
      "estratégias diferentes durante a Copa.",
      "",
      "Mais possibilidades. Mais combinações. Mais chances de pontuar.",
    ], "GARANTIR MINHAS COTAS", url),
  };
}

// ────────────────────────────────────────────────
// TERÇA 20H
// ────────────────────────────────────────────────
function buildTer20h(params: CopaEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = " Você já vai assistir aos jogos mesmo";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText(
      `Você já vai acompanhar a Copa.<br />
      Vai comentar no grupo.<br />
      Vai dar palpite.<br />
      Vai discutir resultado.`,
    )}
    ${emailBodyText(
      `A única diferença é:<br /><br />
      com uma cota você participa da disputa.`,
    )}
    ${emailBodyText(` Mais de ${emailStrong("R$1 milhão")} em premiações`)}
    ${emailPrimaryButton(url, "ENTRAR NA DISPUTA")}
  `;

  return {
    subject,
    html: shell(subject, "Você vai assistir de qualquer jeito. Com uma cota você disputa R$1 milhão.", bodyHtml),
    text: textLines(first, subject, [
      "Você já vai acompanhar a Copa.",
      "Vai comentar no grupo.",
      "Vai dar palpite.",
      "Vai discutir resultado.",
      "",
      "A única diferença é:",
      "com uma cota você participa da disputa.",
      "",
      " Mais de R$1 milhão em premiações",
    ], "ENTRAR NA DISPUTA", url),
  };
}

// ────────────────────────────────────────────────
// QUARTA 09H
// ────────────────────────────────────────────────
function buildQua09h(params: CopaEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "🌎 A Copa inteira por apenas R$29,90";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText(
      `São ${emailStrong("39 dias")} de Copa.<br />
      Mais de ${emailStrong("100 jogos")}.<br />
      Uma única participação.<br />
      Por apenas ${emailStrong("R$29,90")}.`,
    )}
    ${emailBodyText(
      "Enquanto milhões apenas assistem, você disputa posição e premiações.",
    )}
    ${emailPrimaryButton(url, "GARANTIR MINHA COTA")}
  `;

  return {
    subject,
    html: shell(subject, "39 dias. Mais de 100 jogos. Uma participação. R$29,90.", bodyHtml),
    text: textLines(first, subject, [
      "São 39 dias de Copa.",
      "Mais de 100 jogos.",
      "Uma única participação.",
      "Por apenas R$29,90.",
      "",
      "Enquanto milhões apenas assistem, você disputa posição e premiações.",
    ], "GARANTIR MINHA COTA", url),
  };
}

// ────────────────────────────────────────────────
// QUARTA 12H
// ────────────────────────────────────────────────
function buildQua12h(params: CopaEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = " O maior bolão da Copa já começou";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText(
      `A Copa nem começou.<br />
      Mas ${emailStrong("milhares de pessoas")} já estão garantindo sua participação.`,
    )}
    ${emailBodyText(
      `Você já está cadastrado.<br />
      Agora falta apenas um passo.`,
    )}
    ${emailPrimaryButton(url, "GARANTIR MINHA PARTICIPAÇÃO")}
  `;

  return {
    subject,
    html: shell(subject, "Milhares já garantiram. Você já está cadastrado. Falta um passo.", bodyHtml),
    text: textLines(first, subject, [
      "A Copa nem começou.",
      "Mas milhares de pessoas já estão garantindo sua participação.",
      "",
      "Você já está cadastrado.",
      "Agora falta apenas um passo.",
    ], "GARANTIR MINHA PARTICIPAÇÃO", url),
  };
}

// ────────────────────────────────────────────────
// QUARTA 16H
// ────────────────────────────────────────────────
function buildQua16h(params: CopaEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = " Mais de R$1 milhão será distribuído";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("A cada Copa surgem histórias inesquecíveis.")}
    ${emailBodyText(
      `Agora imagine acompanhar todos os jogos disputando
      ${emailStrong("mais de R$1 milhão")} em premiações.`,
    )}
    ${emailBodyText("Essa é a proposta do Bolão do Milhão.")}
    ${emailPrimaryButton(url, "ENTRAR AGORA")}
  `;

  return {
    subject,
    html: shell(subject, "Acompanhe todos os jogos disputando mais de R$1 milhão em premiações.", bodyHtml),
    text: textLines(first, subject, [
      "A cada Copa surgem histórias inesquecíveis.",
      "",
      "Agora imagine acompanhar todos os jogos disputando",
      "mais de R$1 milhão em premiações.",
      "",
      "Essa é a proposta do Bolão do Milhão.",
    ], "ENTRAR AGORA", url),
  };
}

// ────────────────────────────────────────────────
// QUARTA 20H
// ────────────────────────────────────────────────
function buildQua20h(params: CopaEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = " E se seu palpite estiver certo?";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("Pensa nisso.")}
    ${emailBodyText(
      `Brasil entra em campo.<br />
      Você acerta o placar.<br />
      Acerta os escanteios.<br /><br />
      Mas não comprou a cota.`,
    )}
    ${emailBodyText(emailStrong("Não espere o jogo chegar."))}
    ${emailPrimaryButton(url, "GARANTIR MINHA PARTICIPAÇÃO")}
  `;

  return {
    subject,
    html: shell(subject, "E se você acertar o placar e os escanteios, mas não tiver comprado a cota?", bodyHtml),
    text: textLines(first, subject, [
      "Pensa nisso.",
      "",
      "Brasil entra em campo.",
      "Você acerta o placar.",
      "Acerta os escanteios.",
      "",
      "Mas não comprou a cota.",
      "",
      "Não espere o jogo chegar.",
    ], "GARANTIR MINHA PARTICIPAÇÃO", url),
  };
}

// ────────────────────────────────────────────────
// QUINTA 09H
// ────────────────────────────────────────────────
function buildQui09h(params: CopaEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "🚨 Faltam poucos dias para a Copa";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("A maior competição do planeta está chegando.")}
    ${emailBodyText(
      `Quem entrar agora participa ${emailStrong("desde o primeiro jogo")}.<br /><br />
      Quem deixar para depois corre o risco de perder a oportunidade.`,
    )}
    ${emailPrimaryButton(url, "GARANTIR MINHA COTA")}
  `;

  return {
    subject,
    html: shell(subject, "A Copa está chegando. Quem entrar agora participa desde o primeiro jogo.", bodyHtml),
    text: textLines(first, subject, [
      "A maior competição do planeta está chegando.",
      "",
      "Quem entrar agora participa desde o primeiro jogo.",
      "Quem deixar para depois corre o risco de perder a oportunidade.",
    ], "GARANTIR MINHA COTA", url),
  };
}

// ────────────────────────────────────────────────
// QUINTA 12H
// ────────────────────────────────────────────────
function buildQui12h(params: CopaEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = " Você já conhece o sistema";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText(
      `Você já participou dos bolões gratuitos.<br />
      Já viu como funciona.<br />
      Já enviou palpites.`,
    )}
    ${emailBodyText(
      `Agora só falta garantir sua participação na
      ${emailStrong("principal disputa da Copa")}.`,
    )}
    ${emailPrimaryButton(url, "COMPRAR MINHA COTA")}
  `;

  return {
    subject,
    html: shell(subject, "Você já usou os bolões gratuitos. Agora falta um passo para a Copa.", bodyHtml),
    text: textLines(first, subject, [
      "Você já participou dos bolões gratuitos.",
      "Já viu como funciona.",
      "Já enviou palpites.",
      "",
      "Agora só falta garantir sua participação na principal disputa da Copa.",
    ], "COMPRAR MINHA COTA", url),
  };
}

// ────────────────────────────────────────────────
// QUINTA 16H
// ────────────────────────────────────────────────
function buildQui16h(params: CopaEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = "🇧🇷 Última chamada para participar da promoção";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText("Lembre-se:")}
    ${emailBodyText("Quem acertar:")}
    ${emailBodyText(
      ` placar exato do Brasil<br />
       número de escanteios`,
    )}
    ${emailBodyText("ganha:")}
    ${emailBodyText(
      ` ${emailStrong("R$1.000 no PIX")}<br />
       ${emailStrong("Camisa oficial da Seleção Brasileira")}`,
    )}
    ${emailBodyText(
      `Mas apenas ${emailStrong("participantes do Bolão do Milhão")} podem ganhar.`,
    )}
    ${emailPrimaryButton(url, "GARANTIR MINHA PARTICIPAÇÃO")}
  `;

  return {
    subject,
    html: shell(subject, "Última chance. Acerte o Brasil e ganhe R$1.000 + camisa oficial.", bodyHtml),
    text: textLines(first, subject, [
      "Lembre-se:",
      "",
      "Quem acertar:",
      " placar exato do Brasil",
      " número de escanteios",
      "",
      "ganha:",
      " R$1.000 no PIX",
      " Camisa oficial da Seleção Brasileira",
      "",
      "Mas apenas participantes do Bolão do Milhão podem ganhar.",
    ], "GARANTIR MINHA PARTICIPAÇÃO", url),
  };
}

// ────────────────────────────────────────────────
// QUINTA 20H
// ────────────────────────────────────────────────
function buildQui20h(params: CopaEmailParams): EmailOutput {
  const url = getEmailBoloesUrl();
  const subject = " Último aviso";
  const first = emailFirstName(params.recipientName);

  const bodyHtml = `
    ${emailGreeting(hi(params.recipientName))}
    ${emailBodyText(
      `Você já conhece o projeto.<br />
      Já conhece a plataforma.<br />
      Já sabe como funciona.`,
    )}
    ${emailBodyText(
      `Agora a decisão é simples:<br /><br />
      continuar de fora<br />
      ou disputar a Copa inteira por apenas ${emailStrong("R$29,90")}.`,
    )}
    ${emailBodyText(
      ` Mais de R$1 milhão em premiações<br />
       Copa inteira<br />
       R$1.000 + camisa oficial na promoção do Brasil`,
    )}
    ${emailPrimaryButton(url, "GARANTIR MINHA COTA AGORA")}
  `;

  return {
    subject,
    html: shell(subject, "Continuar de fora ou disputar a Copa inteira por R$29,90?", bodyHtml),
    text: textLines(first, subject, [
      "Você já conhece o projeto.",
      "Já conhece a plataforma.",
      "Já sabe como funciona.",
      "",
      "Agora a decisão é simples:",
      "continuar de fora",
      "ou disputar a Copa inteira por apenas R$29,90.",
      "",
      " Mais de R$1 milhão em premiações",
      " Copa inteira",
      " R$1.000 + camisa oficial na promoção do Brasil",
    ], "GARANTIR MINHA COTA AGORA", url),
  };
}

// ────────────────────────────────────────────────
// Dispatch map
// ────────────────────────────────────────────────
export const COPA_BOLAO_EMAIL_BUILDERS: Record<
  string,
  (params: CopaEmailParams) => EmailOutput
> = {
  ter_09h: buildTer09h,
  ter_12h: buildTer12h,
  ter_16h: buildTer16h,
  ter_20h: buildTer20h,
  qua_09h: buildQua09h,
  qua_12h: buildQua12h,
  qua_16h: buildQua16h,
  qua_20h: buildQua20h,
  qui_09h: buildQui09h,
  qui_12h: buildQui12h,
  qui_16h: buildQui16h,
  qui_20h: buildQui20h,
};
