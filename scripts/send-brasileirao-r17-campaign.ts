/**
 * Disparo da campanha 17ª rodada — todos os e-mails cadastrados.
 *
 *   npm run email:disparo              # envia de verdade (sem duplicar)
 *   npm run email:disparo -- --dry-run # só simula
 */
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env" });

import { isResendConfigured } from "../lib/email/config";
import { dispatchBrasileiraoR17EmailToAllUsers } from "../lib/email/campaigns/brasileirao-r17-reminder";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (!dryRun && !isResendConfigured()) {
    console.error("[email:disparo] RESEND_API_KEY / EMAIL_FROM ausentes.");
    process.exit(1);
  }

  console.info("[email:disparo] Resend:", isResendConfigured());
  console.info("[email:disparo] modo:", dryRun ? "dry-run" : "envio-real");

  const result = await dispatchBrasileiraoR17EmailToAllUsers({ dryRun });
  console.info("[email:disparo] resultado:", JSON.stringify(result, null, 2));

  if (!result.ran && result.reason) {
    console.warn("[email:disparo] não executou:", result.reason);
    process.exit(2);
  }

  if (result.failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("[email:disparo] falhou", e);
  process.exit(1);
});
