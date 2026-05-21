/**
 * Valida variáveis necessárias para e-mail e cadastro em produção.
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/check-email-env.ts
 */
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env" });

const isProd = process.env.NODE_ENV === "production";

type Check = { name: string; ok: boolean; hint?: string };

function check(name: string, ok: boolean, hint?: string): Check {
  return { name, ok, hint };
}

const checks: Check[] = [
  check(
    "APP_URL",
    Boolean(process.env.APP_URL?.trim()?.startsWith("http")),
    "Ex.: https://app.bolaodomilhao.com.br (logo nos e-mails)",
  ),
  check("RESEND_API_KEY", Boolean(process.env.RESEND_API_KEY?.trim()), "Painel Resend"),
  check(
    "EMAIL_FROM",
    Boolean(process.env.EMAIL_FROM?.trim() || process.env.RESEND_FROM?.trim()),
    'Ex.: Bolão do Milhão <noreply@seudominio.com.br>',
  ),
  check(
    "REGISTRATION_WHATSAPP_WEBHOOK_URL",
    Boolean(process.env.REGISTRATION_WHATSAPP_WEBHOOK_URL?.trim()),
    "SellFlux — código de confirmação do cadastro",
  ),
  check("AUTH_SECRET", (process.env.AUTH_SECRET?.trim().length ?? 0) >= 32, "Mín. 32 caracteres"),
];

let failed = 0;
console.info(`[check-email-env] NODE_ENV=${process.env.NODE_ENV ?? "development"}\n`);

for (const c of checks) {
  const mark = c.ok ? "OK" : isProd ? "FALTA" : "aviso";
  console.info(`  [${mark}] ${c.name}${c.hint && !c.ok ? ` — ${c.hint}` : ""}`);
  if (!c.ok && isProd) failed++;
}

const logoPath = `${(process.env.APP_URL ?? "").replace(/\/+$/, "")}/email/logo.png`;
if (process.env.APP_URL?.trim()) {
  console.info(`\n  Logo e-mail: ${logoPath}`);
}

console.info("");
if (failed > 0) {
  console.error(`[check-email-env] ${failed} variável(is) obrigatória(s) em produção.`);
  process.exit(1);
}
console.info("[check-email-env] Pronto para produção (e-mail + WhatsApp cadastro).");
