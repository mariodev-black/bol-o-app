/**
 * Dispara e-mail de boas-vindas (teste Resend).
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/send-test-welcome-email.ts mariodev.profissional@gmail.com
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/send-test-welcome-email.ts email@exemplo.com "Seu Nome"
 *
 * Com conta no banco (fluxo igual produção):
 *   ... --production
 *
 * Sem conta (só template + Resend):
 *   ... --force
 */
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env" });

import { isResendConfigured } from "../lib/email/config";
import { sendWelcomeEmail } from "../lib/email/registration";
import { parseTransactionalEmail } from "../lib/email/address";
import { buildWelcomeEmail } from "../lib/email/templates/welcome";
import { sendEmail } from "../lib/email/send";
import { EMAIL_TAG_WELCOME } from "../lib/email/policy";

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const production = process.argv.includes("--production");
  const force = process.argv.includes("--force") || !production;

  const emailRaw = args[0];
  const name = args[1] ?? "Mario";

  if (!emailRaw) {
    console.error("Uso: npx tsx scripts/send-test-welcome-email.ts <email> [nome] [--production|--force]");
    process.exit(1);
  }

  const parsed = parseTransactionalEmail(emailRaw);
  if (!parsed.ok) {
    console.error("[test-welcome]", parsed.error);
    process.exit(1);
  }

  console.info("[test-welcome] destino:", parsed.email);
  console.info("[test-welcome] Resend configurado:", isResendConfigured());
  console.info("[test-welcome] modo:", production ? "production (exige usuário no banco)" : "force (template direto)");

  if (production) {
    const result = await sendWelcomeEmail({
      email: parsed.email,
      name,
    });
    if (!result.sent) {
      console.error("[test-welcome] falhou:", result.error ?? "unknown");
      process.exit(1);
    }
    console.info("[test-welcome] OK — boas-vindas enviado (fluxo produção).");
    return;
  }

  const { subject, html, text } = buildWelcomeEmail({ recipientName: name });
  const result = await sendEmail({
    to: parsed.email,
    subject: `[TESTE] ${subject}`,
    html,
    text,
    category: EMAIL_TAG_WELCOME,
  });

  if (!result.ok) {
    console.error("[test-welcome] falhou:", result.error);
    process.exit(1);
  }

  if ("devLogged" in result && result.devLogged) {
    console.info("[test-welcome] dev — HTML no log acima (sem RESEND_API_KEY efetivo).");
  } else if ("id" in result) {
    console.info("[test-welcome] OK — id Resend:", result.id);
  }
}

main().catch((e) => {
  console.error("[test-welcome]", e);
  process.exit(1);
});
