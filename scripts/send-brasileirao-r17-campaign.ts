/**
 * Campanha 17ª rodada Brasileirão — todos os e-mails cadastrados (sem duplicar).
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/run-email-campaign-migration.ts
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/send-brasileirao-r17-campaign.ts --dry-run
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/send-brasileirao-r17-campaign.ts --force
 */
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env" });

import { isResendConfigured } from "../lib/email/config";
import { runBrasileiraoR17Campaign } from "../lib/email/campaigns/brasileirao-r17-reminder";

async function main() {
  const argv = process.argv.slice(2);
  const force = argv.includes("--force");
  const dryRun = argv.includes("--dry-run");

  console.info("[campaign] Resend configurado:", isResendConfigured());
  console.info("[campaign] modo:", dryRun ? "dry-run" : force ? "force" : "agendado");

  const result = await runBrasileiraoR17Campaign({ force, dryRun });
  console.info("[campaign] resultado:", JSON.stringify(result, null, 2));

  if (!result.ran && result.reason) {
    console.warn("[campaign] não executou:", result.reason);
    if (!force && !dryRun) process.exit(2);
  }

  if (result.failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("[campaign] falhou", e);
  process.exit(1);
});
