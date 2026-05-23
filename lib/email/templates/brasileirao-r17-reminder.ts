import { EMAIL_BRAND as C } from "@/lib/email/brand";
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
  const headline = "17ª rodada do Brasileirão — manda teus palpites!";
  const subject = `${headline} 🔥`;

  const bodyHtml = `
    ${emailGreeting(
      first
        ? `Fala, ${escapeEmailHtml(first)} 👀`
        : "Fala, boleiro 👀",
    )}
    ${emailBodyText(
      `A <strong style="color:${C.text};">17ª rodada do Brasileirão</strong> já vai começar e teus palpites podem te colocar lá em cima na classificação 🔥`,
    )}
    ${emailBodyText(
      `🏆 Bolão grátis<br />
      💰 Valendo 10 mil<br />
      ⚽ Jogos durante o fim de semana inteiro`,
    )}
    ${emailBodyText(
      `Então já manda teus palpites porque:<br /><br />
      <strong style="color:${C.text};">sem palpite = sem chance</strong> 😂`,
    )}
    ${emailBodyText(
      `E chama tua resenha também 👀<br /><br />
      Além de disputar junto contigo, tu ainda ganha <strong style="color:${C.text};">R$8,00</strong> por cada amigo indicado 🔥<br /><br />
      Quanto mais amigo entrar, mais grana tu pode fazer 😎`,
    )}
    ${emailPrimaryButton(palpitesUrl, "Enviar palpites")}
    ${emailPrimaryButton(indiqueUrl, "Chamar amigos")}
  `;

  const html = renderEmailShell({
    preheader:
      "Bolão grátis valendo 10 mil — palpita no fim de semana e chama a resenha.",
    headline,
    bodyHtml,
    footerNote:
      "Você recebeu este e-mail por ter conta no Bolão do Milhão. Se não quiser mais este tipo de mensagem, responda pedindo remoção.",
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
    appName,
  ].join("\n");

  return { subject, html, text };
}
