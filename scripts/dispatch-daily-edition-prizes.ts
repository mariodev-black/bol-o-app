/**
 * Credita Top 10 do Bolão Diário (edição) e dispara notificações app + PWA.
 *
 * Uso:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/dispatch-daily-edition-prizes.ts 7
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/dispatch-daily-edition-prizes.ts 7 --dry-run
 */
import dotenv from "dotenv";
dotenv.config();

import {
  creditAndNotifyDailyEditionPrizes,
  creditDailyEditionTop10Prizes,
} from "@/lib/boloes/daily-edition-prize-dispatch";

async function main() {
  const editionArg = process.argv[2];
  const editionNumber = Number.parseInt(editionArg ?? "", 10);
  if (!Number.isFinite(editionNumber) || editionNumber < 1) {
    console.error("Uso: dispatch-daily-edition-prizes.ts <editionNumber> [--dry-run] [--no-notify]");
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");
  const noNotify = process.argv.includes("--no-notify");

  if (dryRun) {
    const credit = await creditDailyEditionTop10Prizes({ editionNumber, dryRun: true });
    console.log(JSON.stringify(credit, null, 2));
    return;
  }

  const result = await creditAndNotifyDailyEditionPrizes({
    editionNumber,
    notify: !noNotify,
    channels: ["app", "push"],
  });

  console.log("[daily-edition-prizes] credit", {
    edition: result.credit.editionNumber,
    tickets: result.credit.ticketsCount,
    revenueCents: result.credit.totalRevenueCents,
    poolCents: result.credit.poolCents,
    winners: result.credit.winners.map((w) => ({
      pos: w.position,
      user: w.displayName,
      pts: w.totalPoints,
      amount: w.amountLabel,
      credited: result.credit.credited.find((c) => c.position === w.position)?.alreadyCredited === false,
    })),
  });

  if (result.notify) {
    console.log("[daily-edition-prizes] notify", result.notify);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
