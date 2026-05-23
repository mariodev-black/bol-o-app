import {
  getEmailAppName,
  getEmailBoloesUrl,
  getEmailLoginUrl,
  getEmailPalpitesUrl,
} from "@/lib/email/config";
import { emailFirstName, escapeEmailHtml } from "@/lib/email/recipient";
import { SITE_TAGLINE } from "@/lib/seo/config";
import {
  emailBodyText,
  emailGreeting,
  emailPrimaryButton,
  emailSectionTitle,
  emailStepsList,
  emailStrong,
  emailTextLink,
  renderEmailShell,
} from "@/lib/email/templates/email-shell";

export type WelcomeEmailParams = {
  recipientName?: string | null;
};

export function buildWelcomeEmail(params: WelcomeEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const appName = getEmailAppName();
  const boloesUrl = getEmailBoloesUrl();
  const palpitesUrl = getEmailPalpitesUrl();
  const loginUrl = getEmailLoginUrl();
  const first = emailFirstName(params.recipientName);
  const headline = "Sua conta está ativa";
  const subject = `${headline} — ${appName}`;

  const bodyHtml = `
    ${emailGreeting(first ? `Olá, ${first},` : "Olá,")}
    ${emailBodyText(
      `Bem-vindo ao ${emailStrong(escapeEmailHtml(appName))} — ${escapeEmailHtml(SITE_TAGLINE)}.`,
    )}
    ${emailBodyText(
      "Seu cadastro foi concluído. Agora você pode comprar tickets, enviar palpites antes do apito inicial e acompanhar sua posição no ranking com pontuação automática após cada jogo.",
    )}
    ${emailSectionTitle("Como começar")}
    ${emailStepsList([
      {
        title: "Escolha seu bolão",
        description:
          "Acesse Bolões e participe do geral, do diário ou de campeonatos extras. Cada modalidade tem regras e premiação definidas.",
      },
      {
        title: "Compre seu ticket",
        description:
          "Adquira o ticket do bolão escolhido para liberar seus palpites na Copa.",
      },
      {
        title: "Faça seus palpites",
        description:
          "Na aba Palpites, informe placar, vencedor ou artilheiro — sempre antes do início de cada partida.",
      },
      {
        title: "Acompanhe o ranking",
        description:
          "Seus pontos são calculados automaticamente. Veja sua colocação atualizar após cada resultado.",
      },
    ])}
    ${emailPrimaryButton(boloesUrl, "Escolher meu bolão")}
    ${emailBodyText(
      `Também pode ir direto para ${emailTextLink(palpitesUrl, "Palpites")} ou ${emailTextLink(loginUrl, "entrar na conta")} em outro dispositivo.`,
    )}
  `;

  const html = renderEmailShell({
    preheader: "Cadastro concluído. Veja o passo a passo para começar.",
    headline,
    bodyHtml,
    footerNote: "E-mail automático. Se você não criou esta conta, ignore.",
  });

  const text = [
    subject,
    "",
    first ? `Olá, ${first},` : "Olá,",
    "",
    `${appName} — ${SITE_TAGLINE}`,
    "",
    "Seu cadastro foi concluído. Compre tickets, envie palpites e acompanhe o ranking.",
    "",
    "Como começar:",
    "1. Escolha seu bolão — geral, diário ou campeonatos extras.",
    "2. Compre o ticket do bolão escolhido.",
    "3. Faça palpites na aba Palpites antes de cada jogo.",
    "4. Acompanhe o ranking com pontuação automática.",
    "",
    `Bolões: ${boloesUrl}`,
    `Palpites: ${palpitesUrl}`,
    `Login: ${loginUrl}`,
  ].join("\n");

  return { subject, html, text };
}
