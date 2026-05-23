import {
  getEmailAppName,
  getEmailIndiqueUrl,
  getEmailPalpitesUrl,
} from "@/lib/email/config";
import { emailFirstName, escapeEmailHtml } from "@/lib/email/recipient";
import {
  emailBodyText,
  emailGreeting,
  emailPrimaryButton,
  emailStrong,
  renderEmailShell,
} from "@/lib/email/templates/email-shell";

export type BrasileiraoR17ReminderParams = {
  recipientName?: string | null;
};

export function buildBrasileiraoR17ReminderEmail(
  params: BrasileiraoR17ReminderParams,
): { subject: string; html: string; text: string } {
  const appName = getEmailAppName();
  const palpitesUrl = getEmailPalpitesUrl();
  const indiqueUrl = getEmailIndiqueUrl();
  const first = emailFirstName(params.recipientName);
  const headline = "17ª rodada do Brasileirão — envie seus palpites";
  const subject = headline;

  const bodyHtml = `
    ${emailGreeting(
      first
        ? `Fala, ${escapeEmailHtml(first)} 👀`
        : "Fala, boleiro 👀",
    )}
    ${emailBodyText(
      `A ${emailStrong("17ª rodada do Brasileirão")} já vai começar e teus palpites podem te colocar lá em cima na classificação 🔥`,
    )}
    ${emailBodyText(
      `🏆 Bolão grátis<br />
      💰 Valendo 10 mil<br />
      ⚽ Jogos durante o fim de semana inteiro`,
    )}
    ${emailBodyText(
      `Então já manda teus palpites porque:<br /><br />
      ${emailStrong("sem palpite = sem chance")} 😂`,
    )}
    ${emailBodyText(
      `E chama tua resenha também 👀<br /><br />
      Além de disputar junto contigo, tu ainda ganha ${emailStrong("R$8,00")} por cada amigo indicado 🔥<br /><br />
      Quanto mais amigo entrar, mais grana tu pode fazer 😎`,
    )}
    ${emailPrimaryButton(palpitesUrl, "Enviar palpites")}
    ${emailPrimaryButton(indiqueUrl, "Chamar amigos")}
  `;

  const html = renderEmailShell({
    preheader:
      "Bolão grátis valendo 10 mil. Palpites do fim de semana no Brasileirão.",
    headline,
    bodyHtml,
    marketingFooter: true,
    footerNote:
      "Você recebeu este e-mail por ter conta ativa no Bolão do Milhão.",
  });

  const greeting = first ? `Fala, ${first} 👀` : "Fala, boleiro 👀";
  const text = [
    subject,
    "",
    greeting,
    "",
    "A 17ª rodada do Brasileirão já vai começar e teus palpites podem te colocar lá em cima na classificação 🔥",
    "",
    "🏆 Bolão grátis",
    "💰 Valendo 10 mil",
    "⚽ Jogos durante o fim de semana inteiro",
    "",
    "Então já manda teus palpites porque:",
    "sem palpite = sem chance 😂",
    "",
    "E chama tua resenha também 👀",
    "",
    "Além de disputar junto contigo, tu ainda ganha R$8,00 por cada amigo indicado 🔥",
    "Quanto mais amigo entrar, mais grana tu pode fazer 😎",
    "",
    `Enviar palpites: ${palpitesUrl}`,
    `Chamar amigos: ${indiqueUrl}`,
    "",
    "Para não receber mais e-mails promocionais, responda este e-mail pedindo descadastro.",
    "",
    appName,
  ].join("\n");

  return { subject, html, text };
}
