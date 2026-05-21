import { EMAIL_BRAND as C } from "@/lib/email/brand";
import { getEmailAppName } from "@/lib/email/config";
import { renderEmailLogoImg } from "@/lib/email/logo-embed";
import { getAppOrigin } from "@/lib/seo/config";

const EMAIL_WIDTH = 560;

export type EmailShellParams = {
  preheader?: string;
  /** Título principal (H1 centralizado), igual ao assunto do e-mail. */
  headline: string;
  bodyHtml: string;
  footerNote: string;
};

/**
 * Layout transacional: logo → H1 (assunto) → corpo objetivo → rodapé.
 * Estrutura inspirada em e-mails Hostinger (fácil leitura, uma ação clara).
 */
export function renderEmailShell(params: EmailShellParams): string {
  const appName = getEmailAppName();
  const appUrl = getAppOrigin();
  const year = new Date().getFullYear();
  const logo = renderEmailLogoImg({ width: 160, alt: appName });
  const preheader = params.preheader ?? params.headline;

  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${escapeHtml(params.headline)} — ${escapeHtml(appName)}</title>
  <style type="text/css">
    body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: ${C.bg} !important; }
    a { color: ${C.accent}; }
  </style>
</head>
<body bgcolor="${C.bg}" style="margin:0;padding:0;width:100%;background-color:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.bg};">
    ${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background-color:${C.bg};">
    <tr>
      <td align="center" bgcolor="${C.bg}" style="background-color:${C.bg};padding:24px 16px 32px;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:${EMAIL_WIDTH}px;">

          <tr>
            <td bgcolor="${C.bgElevated}" style="background-color:${C.bgElevated};border:1px solid ${C.border};border-radius:12px;overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:36px 40px 0;">
                    <a href="${escapeAttr(appUrl)}" target="_blank" style="text-decoration:none;">${logo}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 40px 36px;">
                    ${emailH1(params.headline)}
                    ${params.bodyHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:20px 8px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:${EMAIL_WIDTH}px;">
                <tr>
                  <td style="height:1px;background-color:${C.border};font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td align="center" style="padding:20px 12px 0;">
                    <p style="margin:0;font-size:12px;line-height:1.55;color:${C.textDim};text-align:center;">${escapeHtml(params.footerNote)}</p>
                    <p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:${C.textDim};text-align:center;">
                      <a href="${escapeAttr(appUrl)}" target="_blank" style="color:${C.accentMuted};text-decoration:underline;">${escapeHtml(appName)}</a>
                      &nbsp;·&nbsp;© ${year}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** H1 centralizado — resume o assunto do e-mail. */
export function emailH1(text: string): string {
  return `<h1 style="margin:0 0 28px;font-size:26px;line-height:1.25;font-weight:800;color:${C.text};text-align:center;letter-spacing:-0.02em;">${escapeHtml(text)}</h1>`;
}

export function emailGreeting(html: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:${C.text};text-align:left;">${html}</p>`;
}

export function emailBodyText(html: string): string {
  return `<p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:${C.textMuted};text-align:left;">${html}</p>`;
}

/** Subtítulo de seção (ex.: passo a passo). */
export function emailSectionTitle(text: string): string {
  return `<p style="margin:24px 0 14px;font-size:15px;line-height:1.4;font-weight:700;color:${C.text};text-align:left;">${escapeHtml(text)}</p>`;
}

/** Lista numerada objetiva — título + descrição por passo. */
export function emailStepsList(
  items: { title: string; description: string }[],
): string {
  const rows = items
    .map(
      (item, i) => `
  <tr>
    <td style="padding:${i === 0 ? "0" : "12px"} 0 0;">
      <p style="margin:0 0 6px;font-size:14px;line-height:1.5;color:${C.text};text-align:left;">
        <span style="color:${C.accent};font-weight:800;">${i + 1}.</span>
        <strong style="color:${C.text};">${escapeHtml(item.title)}</strong>
      </p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:${C.textMuted};text-align:left;padding-left:20px;">${escapeHtml(item.description)}</p>
    </td>
  </tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">${rows}</table>`;
}

export function emailHighlightBox(innerHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td align="center" bgcolor="${C.bgInset}" style="background-color:${C.bgInset};border:1px solid ${C.border};border-radius:8px;padding:26px 20px;">
      ${innerHtml}
    </td>
  </tr>
</table>`;
}

export function emailCodeBlock(code: string): string {
  return emailHighlightBox(
    `<span style="font-size:34px;font-weight:800;letter-spacing:0.26em;color:${C.accent};font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;line-height:1;">${escapeHtml(code)}</span>`,
  );
}

export function emailAttention(html: string): string {
  return `<p style="margin:20px 0 0;font-size:14px;line-height:1.65;color:${C.textMuted};text-align:left;">
    <strong style="color:${C.text};">Atenção:</strong> ${html}
  </p>`;
}

export function emailPrimaryButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0 8px;">
  <tr>
    <td align="center">
      <a href="${escapeAttr(href)}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:800;color:${C.buttonText};text-decoration:none;border-radius:8px;background-color:${C.accent};">
        ${escapeHtml(label)}
      </a>
    </td>
  </tr>
</table>`;
}

export function emailTextLink(href: string, label: string): string {
  return `<a href="${escapeAttr(href)}" target="_blank" style="color:${C.accent};font-weight:600;text-decoration:underline;">${escapeHtml(label)}</a>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
