import "dotenv/config";
import {
  creditSerieBTop3Prizes,
  SERIE_B_PRIZE_AMOUNTS_BRL,
} from "@/lib/boloes/serie-b-prize-dispatch";

const rodada = Math.max(1, Number.parseInt(process.argv[2] ?? "12", 10) || 12);
const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`[serie-b:prizes] rodada=${rodada} dryRun=${dryRun}`);
  const result = await creditSerieBTop3Prizes({ rodada, dryRun });

  console.log("Premios:", SERIE_B_PRIZE_AMOUNTS_BRL);
  console.log("Ganhadores:");
  for (const w of result.winners) {
    console.log(
      `  ${w.position}º ${w.displayName} (${w.totalPoints} pts) ticket=${w.ticketId}`,
    );
  }
  console.log("Creditos:");
  for (const c of result.credited) {
    const label = c.alreadyCredited ? "ja creditado" : dryRun ? "simulado" : "creditado";
    console.log(
      `  ${c.position}º user=${c.userId} +R$ ${(c.amountCents / 100).toFixed(2)} (${label})`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
