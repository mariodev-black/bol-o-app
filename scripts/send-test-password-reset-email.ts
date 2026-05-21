/**
 * Dispara e-mail de código de recuperação de senha (teste Resend).
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/send-test-password-reset-email.ts email@exemplo.com
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/send-test-password-reset-email.ts email@exemplo.com "Seu Nome"
 */
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env" });

import { randomInt } from "node:crypto";
import { parseTransactionalEmail } from "../lib/email/address";
import { isResendConfigured } from "../lib/email/config";
import { buildPasswordResetCodeEmail } from "../lib/email/templates/password-reset-code";
import { sendEmail } from "../lib/email/send";
import { EMAIL_TAG_PASSWORD_RESET } from "../lib/email/policy";

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const emailRaw = args[0];
  const name = args[1] ?? "Mario";

  if (!emailRaw) {
    console.error(
      "Uso: npx tsx scripts/send-test-password-reset-email.ts <email> [nome]",
    );
    process.exit(1);
  }

  const parsed = parseTransactionalEmail(emailRaw);
  if (!parsed.ok) {
    console.error("[test-reset]", parsed.error);
    process.exit(1);
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { subject, html, text } = buildPasswordResetCodeEmail({
    code,
    recipientName: name,
  });

  console.info("[test-reset] destino:", parsed.email);
  console.info("[test-reset] código (teste):", code);
  console.info("[test-reset] Resend configurado:", isResendConfigured());

  const result = await sendEmail({
    to: parsed.email,
    subject: `[TESTE] ${subject}`,
    html,
    text,
    category: EMAIL_TAG_PASSWORD_RESET,
  });

  if (!result.ok) {
    console.error("[test-reset] falhou:", result.error);
    process.exit(1);
  }

  if ("devLogged" in result && result.devLogged) {
    console.info("[test-reset] dev — HTML no log (sem RESEND efetivo).");
  } else if ("id" in result) {
    console.info("[test-reset] OK — id Resend:", result.id);
  }
}

main().catch((e) => {
  console.error("[test-reset]", e);
  process.exit(1);
});
