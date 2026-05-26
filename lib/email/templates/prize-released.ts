import { getEmailAppName, getEmailBoloesUrl } from "@/lib/email/config";
import { getAppOrigin } from "@/lib/seo/config";
import { renderEmailLogoImg } from "@/lib/email/logo-embed";
import { emailFirstName, escapeEmailHtml } from "@/lib/email/recipient";
import { resolveAdminBroadcastButtonUrl } from "@/lib/email/resolve-button-url";

const EMAIL_WIDTH = 600;
/** Altura da faixa da logo (desktop). */
const HEADER_HEIGHT_DESKTOP = 80;
/** Altura da faixa da logo no mobile. */
const HEADER_HEIGHT_MOBILE = 60;
const LOGO_WIDTH_DESKTOP = 140;
const LOGO_WIDTH_MOBILE = 96;

const C = {
  bg: "#0a0a0a",
  card: "#141414",
  border: "#2a2a2a",
  inset: "#1e1e1e",
  accent: "#b6f600",
  text: "#ffffff",
  muted: "#b3b3b3",
  dim: "#666666",
  buttonText: "#0a0a0a",
} as const;

/** Gmail/Apple Mail mobile — classes + !important (estilo inline sozinho quebra no app). */
const PRIZE_EMAIL_STYLES = `
  body, table, td, p, a, h1, span { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse !important; }
  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; max-width: 100% !important; height: auto !important; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; min-width: 100% !important; background-color: ${C.bg} !important; }
  .pr-bg { background-color: ${C.bg} !important; }
  .pr-card { background-color: ${C.card} !important; border: 1px solid ${C.border} !important; }
  .pr-text { color: ${C.text} !important; }
  .pr-muted { color: ${C.muted} !important; }
  .pr-accent { color: ${C.accent} !important; }
  .pr-btn-td { background-color: ${C.accent} !important; border-radius: 50px !important; }
  .pr-btn-link { color: ${C.buttonText} !important; text-decoration: none !important; font-weight: 800 !important; }
  .pr-fluid { width: 100% !important; max-width: ${EMAIL_WIDTH}px !important; }
  .pr-header { height: ${HEADER_HEIGHT_DESKTOP}px !important; max-height: ${HEADER_HEIGHT_DESKTOP}px !important; padding: 14px 24px 8px !important; line-height: 0 !important; }
  .pr-logo-link { display: inline-block !important; line-height: 0 !important; max-width: 100% !important; }
  .pr-logo-img { width: ${LOGO_WIDTH_DESKTOP}px !important; max-width: ${LOGO_WIDTH_DESKTOP}px !important; max-height: 52px !important; height: auto !important; margin: 0 auto !important; }
  @media only screen and (max-width: 620px) {
    .pr-outer-pad { padding: 16px 10px 24px !important; }
    .pr-header { height: ${HEADER_HEIGHT_MOBILE}px !important; max-height: ${HEADER_HEIGHT_MOBILE}px !important; padding: 10px 16px !important; }
    .pr-logo-img { width: ${LOGO_WIDTH_MOBILE}px !important; max-width: ${LOGO_WIDTH_MOBILE}px !important; max-height: 40px !important; }
    .pr-title-pad { padding: 0 16px 20px !important; }
    .pr-content-pad { padding: 0 16px 28px !important; }
    .pr-h1 { font-size: 20px !important; line-height: 1.25 !important; letter-spacing: -0.3px !important; }
    .pr-greeting { font-size: 16px !important; }
    .pr-body { font-size: 15px !important; line-height: 1.55 !important; }
    .pr-tier-pad { padding: 16px !important; }
    .pr-tier-line { font-size: 15px !important; line-height: 1.65 !important; }
    .pr-quote { padding-left: 12px !important; font-size: 15px !important; }
    .pr-btn-link { display: block !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; padding: 14px 18px !important; font-size: 14px !important; text-align: center !important; }
    .pr-card { border-radius: 12px !important; width: 100% !important; }
  }
  @media (prefers-color-scheme: dark) {
    .pr-bg { background-color: ${C.bg} !important; }
    .pr-card { background-color: ${C.card} !important; }
    .pr-text { color: ${C.text} !important; }
    .pr-muted { color: ${C.muted} !important; }
    .pr-btn-td { background-color: ${C.accent} !important; }
    .pr-btn-link { color: ${C.buttonText} !important; }
  }
`;

export type PrizeReleasedTier = {
  rankLabel: string;
  amountLabel: string;
};

export type PrizeReleasedEmailParams = {
  recipientName?: string | null;
  introHtml: string;
  headline?: string;
  tiers?: PrizeReleasedTier[];
  progressNoteHtml?: string;
  ctaLabel?: string;
  ctaHref?: string;
  closingHtml?: string;
};

const DEFAULT_TIERS: PrizeReleasedTier[] = [
  { rankLabel: "1º lugar", amountLabel: "R$ 5.000" },
  { rankLabel: "2º lugar", amountLabel: "R$ 2.000" },
  { rankLabel: "3º lugar", amountLabel: "R$ 1.000" },
];

function escapeAttr(value: string): string {
  return escapeEmailHtml(value).replace(/'/g, "&#39;");
}

function renderPrizeTiers(tiers: PrizeReleasedTier[]): string {
  const lines = tiers
    .map((tier, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🏅";
      return `<tr>
        <td class="pr-tier-line pr-text" style="padding:${i === 0 ? "0" : "10px"} 0 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.75;color:${C.text};font-weight:500;">
          ${medal}&nbsp;${escapeEmailHtml(tier.rankLabel)}
          <span style="color:#4a4a4a;">&nbsp;—&nbsp;</span>
          <span class="pr-accent" style="color:${C.accent};font-weight:700;">${escapeEmailHtml(tier.amountLabel)}</span>
        </td>
      </tr>`;
    })
    .join("");

  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="pr-fluid" style="width:100%;max-width:${EMAIL_WIDTH}px;margin-bottom:20px;">
  <tr>
    <td class="pr-tier-pad" style="background-color:${C.inset};border:1px solid #2f2f2f;border-radius:12px;padding:20px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        ${lines}
      </table>
    </td>
  </tr>
</table>`;
}

function renderCtaButton(href: string, label: string): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
  <tr>
    <td align="center" style="padding:4px 0 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-radius:50px;">
        <tr>
          <td class="pr-btn-td" align="center" bgcolor="${C.accent}" style="background-color:${C.accent};border-radius:50px;mso-padding-alt:16px 32px;">
            <a class="pr-btn-link" href="${escapeAttr(href)}" target="_blank" style="display:inline-block;padding:16px 32px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:${C.buttonText};text-decoration:none;background-color:${C.accent};border-radius:50px;">
              ${escapeEmailHtml(label)}
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/**
 * E-mail marketing — premiação liberada (layout escuro + logo anexada no envio).
 */
export function buildPrizeReleasedEmail(
  params: PrizeReleasedEmailParams,
): { subject: string; html: string; text: string } {
  const appName = getEmailAppName();
  const appUrl = getAppOrigin();
  const first = emailFirstName(params.recipientName);
  const headline = (params.headline ?? "Premiação Liberada").trim();
  const subject = headline.includes(appName) ? headline : `${headline} — ${appName}`;
  const tiers = params.tiers?.length ? params.tiers : DEFAULT_TIERS;
  const ctaLabel = (params.ctaLabel ?? "Ir para Bolões").trim();
  const ctaHref = resolveAdminBroadcastButtonUrl(
    (params.ctaHref ?? getEmailBoloesUrl()).trim(),
  );
  const logo = renderEmailLogoImg({
    width: LOGO_WIDTH_DESKTOP,
    alt: appName,
    className: "pr-logo-img",
  });
  const progressNote =
    params.progressNoteHtml?.trim() ||
    `<span style="font-size:18px;line-height:1;">🏅</span> Premiação dividida de forma progressiva até o 10º colocado.`;
  const closing =
    params.closingHtml?.trim() ||
    `E isso foi só o começo 😎<br />O aquecimento pro <strong class="pr-text" style="color:${C.text};font-weight:700;">MAIOR</strong> bolão da Copa já começou.`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${escapeEmailHtml(subject)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">${PRIZE_EMAIL_STYLES}</style>
</head>
<body class="pr-bg" bgcolor="${C.bg}" style="margin:0;padding:0;width:100%;background-color:${C.bg};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.bg};">
    ${escapeEmailHtml(headline)}&nbsp;&zwnj;&nbsp;&zwnj;
  </div>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="pr-bg" bgcolor="${C.bg}" style="width:100%;background-color:${C.bg};">
    <tr>
      <td class="pr-outer-pad pr-bg" align="center" bgcolor="${C.bg}" style="padding:32px 12px;background-color:${C.bg};">
        <!--[if mso]><table role="presentation" align="center" border="0" cellpadding="0" cellspacing="0" width="${EMAIL_WIDTH}"><tr><td><![endif]-->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="${EMAIL_WIDTH}" class="pr-card pr-fluid" style="width:100%;max-width:${EMAIL_WIDTH}px;background-color:${C.card};border-radius:16px;border:1px solid ${C.border};">
          <tr>
            <td class="pr-header pr-logo-pad" align="center" valign="middle" height="${HEADER_HEIGHT_DESKTOP}" bgcolor="${C.card}" style="background-color:${C.card};height:${HEADER_HEIGHT_DESKTOP}px;max-height:${HEADER_HEIGHT_DESKTOP}px;padding:14px 24px 8px;line-height:0;">
              <a class="pr-logo-link" href="${escapeAttr(appUrl)}" target="_blank" style="text-decoration:none;display:inline-block;line-height:0;max-width:100%;">
                ${logo}
              </a>
            </td>
          </tr>
          <tr>
            <td class="pr-title-pad" align="center" bgcolor="${C.card}" style="background-color:${C.card};padding:0 24px 24px;">
              <h1 class="pr-h1 pr-text" style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:24px;font-weight:800;color:${C.text};text-transform:uppercase;letter-spacing:-0.5px;line-height:1.2;">
                ${escapeEmailHtml(headline)}&nbsp;<span style="font-size:26px;line-height:1;">🏆</span>
              </h1>
            </td>
          </tr>
          <tr>
            <td class="pr-content-pad pr-muted" align="left" bgcolor="${C.card}" style="background-color:${C.card};padding:0 24px 32px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:${C.muted};">
              <p class="pr-greeting pr-text" style="margin:0 0 18px;color:${C.text};font-size:17px;font-weight:500;line-height:1.4;">${first ? `Olá, ${escapeEmailHtml(first)},` : "Olá,"}</p>
              <p class="pr-body" style="margin:0 0 20px;color:${C.muted};font-size:16px;line-height:1.6;">${params.introHtml}</p>
              ${renderPrizeTiers(tiers)}
              <p class="pr-body" style="margin:0 0 20px;color:${C.muted};font-size:16px;line-height:1.6;">${progressNote}</p>
              <p class="pr-body pr-quote" style="margin:0 0 20px;padding-left:14px;border-left:3px solid ${C.accent};color:${C.muted};font-size:16px;line-height:1.55;">Os valores já estão disponíveis para saque dentro da plataforma 👀</p>
              <p class="pr-body" style="margin:0 0 20px;color:${C.muted};font-size:16px;line-height:1.6;">Agora é só acessar sua conta, conferir sua colocação final e verificar sua premiação.</p>
              <p class="pr-body" style="margin:0 0 28px;color:${C.muted};font-size:16px;line-height:1.6;">${closing}</p>
              ${renderCtaButton(ctaHref, ctaLabel)}
            </td>
          </tr>
          <tr>
            <td bgcolor="${C.card}" style="background-color:${C.card};padding-bottom:16px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="${EMAIL_WIDTH}" class="pr-fluid" style="width:100%;max-width:${EMAIL_WIDTH}px;">
          <tr>
            <td align="center" style="padding:16px 12px;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:${C.dim};">
              © ${escapeEmailHtml(appName)}. Todos os direitos reservados.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const tierText = tiers
    .map((t) => `${t.rankLabel}: ${t.amountLabel}`)
    .join("\n");

  const text = [
    subject,
    "",
    first ? `Olá, ${first},` : "Olá,",
    "",
    params.introHtml.replace(/<[^>]+>/g, ""),
    "",
    tierText,
    "",
    `${ctaLabel}: ${ctaHref}`,
    "",
    appName,
  ].join("\n");

  return { subject, html, text };
}

/** Defaults para disparo admin — Premier League (ajuste o corpo no painel se precisar). */
export function buildPremierPrizeReleasedBroadcastEmail(input: {
  recipientName?: string | null;
  body: string;
  button: { label: string; url: string } | null;
}): { subject: string; html: string; text: string } {
  const intro =
    input.body.trim() ||
    "O bolão da última rodada da Premier League foi finalizado e o TOP 10 já foi premiado 🔥";

  return buildPrizeReleasedEmail({
    recipientName: input.recipientName,
    headline: "Premiação Liberada",
    introHtml: escapeEmailHtml(intro).replace(/\n/g, "<br />"),
    ctaLabel: input.button?.label?.trim() || "Ir para Bolões",
    ctaHref: input.button?.url?.trim() || getEmailBoloesUrl(),
  });
}
