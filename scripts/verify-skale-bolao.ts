/**
 * Verifica config, preço e espelhamento Copa → Skale.
 * Uso: npm run skale:verify
 */
import { config as loadEnv } from "dotenv";
loadEnv();

import {
  getSkaleBolaoCompetitionId,
  getSkaleBolaoSourceCopaCompetitionId,
  getSkaleBolaoUnitCents,
  isSkaleBolaoCompetition,
} from "../lib/boloes/skale-config";
import { isConfiguredExtraChampionshipId, parseExtraBolaoChampionshipIds } from "../lib/boloes-extra-config";
import {
  buildPurchaseTicketLines,
  getExtraBolaoUnitCentsForChampionship,
} from "../lib/payments/ticket-config";
import { mirrorSkaleBolaoMatchesFromCopa } from "../lib/football/skale-bolao-sync";
import {
  calculateSkalePrizeAwards,
  calculateSkalePrizePoolCents,
} from "../lib/boloes/skale-prize";
import { getPool } from "../lib/db";

async function main() {
  const skaleId = getSkaleBolaoCompetitionId();
  const copaId = getSkaleBolaoSourceCopaCompetitionId();
  const unitCents = getSkaleBolaoUnitCents();

  console.log("[skale:verify] Config");
  console.log(`  competitionId: ${skaleId}`);
  console.log(`  copaSourceId: ${copaId}`);
  console.log(`  unitCents: ${unitCents} (R$ ${(unitCents / 100).toFixed(2)})`);
  console.log(`  in BOLOES_EXTRA: ${isConfiguredExtraChampionshipId(skaleId)}`);
  console.log(`  extras list: ${parseExtraBolaoChampionshipIds().join(", ")}`);

  const priceOk = getExtraBolaoUnitCentsForChampionship(skaleId) === 50_000;
  const lines = buildPurchaseTicketLines(0, 0, {
    extraByChampionship: { [skaleId]: 1 },
  });
  const lineOk =
    lines.length === 1 &&
    lines[0]!.unitCents === 50_000 &&
    lines[0]!.extraChampionshipId === skaleId;
  console.log(`\n[skale:verify] Preço R$ 500: ${priceOk && lineOk ? "OK" : "FALHOU"}`);
  if (!priceOk || !lineOk) {
    console.log("  lines:", lines);
    process.exitCode = 1;
  }

  const revenue = 1_000_000; // R$ 10.000,00 de exemplo
  const prizePool = calculateSkalePrizePoolCents(revenue);
  const awards = calculateSkalePrizeAwards(revenue);
  const prizeOk =
    prizePool === revenue &&
    awards.length === 3 &&
    awards[0]!.amountCents === 600_000 &&
    awards[1]!.amountCents === 300_000 &&
    awards[2]!.amountCents === 100_000;
  console.log(`\n[skale:verify] Premiação 60/30/10: ${prizeOk ? "OK" : "FALHOU"}`);
  if (!prizeOk) {
    console.log("  prizePool:", prizePool, "awards:", awards);
    process.exitCode = 1;
  }

  console.log("\n[skale:verify] Espelhando jogos da Copa...");
  const mirror = await mirrorSkaleBolaoMatchesFromCopa();
  if (!mirror) {
    console.error("  mirror retornou null (SKALE_BOLAO_ENABLED=false?)");
    process.exitCode = 1;
    return;
  }
  console.log(`  mirrored rows: ${mirror.matchesMirrored} (${mirror.ms}ms)`);

  const pool = getPool();
  const { rows } = await pool.query<{ copa: string; skale: string }>(
    `SELECT
       (SELECT COUNT(*)::text FROM matches_cache WHERE competition_id = $1) AS copa,
       (SELECT COUNT(*)::text FROM matches_cache WHERE competition_id = $2) AS skale`,
    [copaId, skaleId],
  );
  const copaCount = Number(rows[0]?.copa ?? 0);
  const skaleCount = Number(rows[0]?.skale ?? 0);
  const matchesOk = copaCount > 0 && skaleCount === copaCount;
  console.log(`\n[skale:verify] Jogos Copa (${copaId}): ${copaCount}`);
  console.log(`[skale:verify] Jogos Skale (${skaleId}): ${skaleCount}`);
  console.log(`[skale:verify] Espelhamento 1:1: ${matchesOk ? "OK" : "FALHOU"}`);

  if (!matchesOk) process.exitCode = 1;

  console.log(`\n[skale:verify] isSkaleBolaoCompetition(${skaleId}): ${isSkaleBolaoCompetition(skaleId)}`);
  console.log("[skale:verify] Concluído.");
}

main().catch((err) => {
  console.error("[skale:verify] FATAL:", err);
  process.exitCode = 1;
});
