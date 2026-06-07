/**
 * Dispara premiação do pódio — Bolão dos Amistosos (1º R$ 1.000 · 2º R$ 500 · 3º R$ 300).
 *
 *   npm run amistosos:prizes -- --dry-run
 *   npm run amistosos:prizes
 *   npm run amistosos:prizes -- --only=email
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env" });

import { getPool, ensureDatabasePoolReady } from "@/lib/db";
import { isResendConfigured } from "@/lib/email/config";
import {
  AMISTOSOS_PRIZE_AMOUNTS_BRL,
  dispatchAmistososPrizeNotifications,
  resolveAmistososTopWinners,
} from "@/lib/boloes/amistosos-prize-dispatch";
import type { AdminBroadcastChannel } from "@/lib/notifications/admin-broadcast-shared";
import { listAmistososAdminMatches } from "@/lib/football/amistosos-friendlies-seed";

function parseChannels(): AdminBroadcastChannel[] {
  for (const arg of process.argv.slice(2)) {
    if (arg === "--only=email") return ["email"];
    if (arg === "--only=app") return ["app"];
    if (arg === "--only=push") return ["push"];
    if (arg === "--only=notify") return ["app", "push"];
  }
  return ["email", "app", "push"];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const channels = parseChannels();

  console.log("[amistosos:prizes] Bolão dos Amistosos — premiação do pódio");
  console.log(
    `[amistosos:prizes] Prêmios: 1º ${AMISTOSOS_PRIZE_AMOUNTS_BRL[1]} · 2º ${AMISTOSOS_PRIZE_AMOUNTS_BRL[2]} · 3º ${AMISTOSOS_PRIZE_AMOUNTS_BRL[3]}`,
  );
  if (dryRun) console.log("[amistosos:prizes] Modo dry-run — nada será enviado.");
  console.log(`[amistosos:prizes] Canais: ${channels.join(", ")}`);

  if (channels.includes("email") && !isResendConfigured() && !dryRun) {
    console.error("[amistosos:prizes] Resend não configurado — abortando envio de e-mail.");
    process.exit(1);
  }

  await ensureDatabasePoolReady();

  const matches = await listAmistososAdminMatches();
  const pending = matches.filter(
    (m) => m.resultCasa == null || m.resultVisitante == null,
  );
  if (pending.length > 0) {
    console.warn(
      `[amistosos:prizes] Aviso: ${pending.length} jogo(s) ainda sem placar oficial.`,
    );
  }

  const winners = await resolveAmistososTopWinners(3);
  if (winners.length === 0) {
    console.error("[amistosos:prizes] Nenhum ganhador encontrado no ranking.");
    await getPool().end().catch(() => {});
    process.exit(1);
  }

  console.log("\nGanhadores:");
  for (const w of winners) {
    const prize = AMISTOSOS_PRIZE_AMOUNTS_BRL[w.position];
    console.log(
      `  ${w.position}º ${w.displayName} — ${w.totalPoints} pts (${w.exactCount} exatos) → ${prize}`,
    );
  }

  const result = await dispatchAmistososPrizeNotifications({
    winners,
    channels,
    dryRun,
  });

  if (!dryRun) {
    console.log("\n[amistosos:prizes] Disparo concluído:");
    console.log(`  E-mail: ${result.email.sent} enviados, ${result.email.failed} falhas, ${result.email.skipped} ignorados`);
    console.log(`  Sininho: ${result.app.created}`);
    console.log(`  Push: ${result.push.sent} enviados, ${result.push.failed} falhas`);
    console.log(`  Batch: ${result.batchId}`);
  }

  await getPool().end().catch(() => {});
}

main().catch(async (err) => {
  console.error("[amistosos:prizes] FATAL:", err);
  await getPool().end().catch(() => {});
  process.exit(1);
});
