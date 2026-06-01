/**
 * Prêmio pos. 4–100 (extra rodada): cota grátis Milhão + e-mail + PWA + sininho.
 *
 *   npm run promo:milhao-gift -- --dry-run
 *   npm run promo:milhao-gift
 *   npm run promo:milhao-gift -- --only=brasileirao
 */
import { config as dotenvConfig } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";

dotenvConfig({ path: ".env" });

import { getPool } from "../lib/db";
import { isResendConfigured } from "../lib/email/config";
import type { AdminBroadcastChannel } from "../lib/notifications/admin-broadcast-shared";
import type { ExtraRoundMilhaoGiftCampaign } from "../lib/promotions/extra-round-milhao-gift";
import {
  dispatchExtraRoundMilhaoGiftCampaign,
  type ExtraRoundMilhaoGiftDispatchResult,
  type ExtraRoundMilhaoGiftRecipient,
} from "../lib/promotions/extra-round-milhao-gift-dispatch";

const DEFAULT_BR_CSV =
  "scripts/output/extra-ranking-top100-comp10-r18-brasileirao-18-rodada.csv";
const DEFAULT_LIB_CSV =
  "scripts/output/extra-ranking-top100-comp7-r6-libertadores-6-rodada.csv";

const POS_MIN = 4;
const POS_MAX = 100;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  result.push(cur);
  return result;
}

function parseCsvRecipients(
  path: string,
  campaign: ExtraRoundMilhaoGiftCampaign,
): ExtraRoundMilhaoGiftRecipient[] {
  const raw = readFileSync(path, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const posIdx = header.indexOf("posicao");
  const userIdx = header.indexOf("user_id");
  const emailIdx = header.indexOf("email");
  if (posIdx < 0 || userIdx < 0) {
    throw new Error(`CSV ${path}: colunas posicao e user_id obrigatórias`);
  }

  const out: ExtraRoundMilhaoGiftRecipient[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]!);
    const pos = Number.parseInt(cols[posIdx] ?? "", 10);
    const userId = (cols[userIdx] ?? "").trim();
    const email = emailIdx >= 0 ? (cols[emailIdx] ?? "").trim() : "";
    if (!Number.isFinite(pos) || pos < POS_MIN || pos > POS_MAX) continue;
    if (!userId) continue;
    out.push({ userId, email, position: pos });
  }

  console.info(
    `[promo:milhao-gift] ${campaign}: ${out.length} destinatários (pos ${POS_MIN}–${POS_MAX}) de ${path}`,
  );
  return out;
}

function parseArgs(): {
  dryRun: boolean;
  only: "all" | "brasileirao" | "libertadores";
  skipTickets: boolean;
  skipNotify: boolean;
  brCsv: string;
  libCsv: string;
} {
  let dryRun = false;
  let only: "all" | "brasileirao" | "libertadores" = "all";
  let skipTickets = false;
  let skipNotify = false;
  let brCsv = DEFAULT_BR_CSV;
  let libCsv = DEFAULT_LIB_CSV;

  for (const arg of process.argv.slice(2)) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--skip-tickets") skipTickets = true;
    else if (arg === "--skip-notify") skipNotify = true;
    else if (arg.startsWith("--only=")) {
      const v = arg.slice("--only=".length);
      if (v === "brasileirao" || v === "libertadores" || v === "all") only = v;
    } else if (arg.startsWith("--brasileirao-csv=")) {
      brCsv = arg.slice("--brasileirao-csv=".length);
    } else if (arg.startsWith("--libertadores-csv=")) {
      libCsv = arg.slice("--libertadores-csv=".length);
    }
  }

  return { dryRun, only, skipTickets, skipNotify, brCsv, libCsv };
}

async function main() {
  const args = parseArgs();
  const channels: AdminBroadcastChannel[] = args.skipNotify
    ? []
    : ["app", "push", "email"];

  if (!args.dryRun && channels.includes("email") && !isResendConfigured()) {
    console.error("[promo:milhao-gift] RESEND_API_KEY / EMAIL_FROM ausentes.");
    process.exit(1);
  }

  console.info("[promo:milhao-gift] modo:", args.dryRun ? "dry-run" : "PRODUÇÃO");
  console.info("[promo:milhao-gift] canais:", channels.join(", ") || "(nenhum)");
  console.info("[promo:milhao-gift] cotas:", args.skipTickets ? "não" : "sim");

  const campaigns: Array<{
    campaign: ExtraRoundMilhaoGiftCampaign;
    csv: string;
  }> = [];

  if (args.only === "all" || args.only === "brasileirao") {
    campaigns.push({
      campaign: "brasileirao_r18",
      csv: join(process.cwd(), args.brCsv),
    });
  }
  if (args.only === "all" || args.only === "libertadores") {
    campaigns.push({
      campaign: "libertadores_r6",
      csv: join(process.cwd(), args.libCsv),
    });
  }

  const summaries: ExtraRoundMilhaoGiftDispatchResult[] = [];

  for (const { campaign, csv } of campaigns) {
    const recipients = parseCsvRecipients(csv, campaign);
    if (recipients.length === 0) {
      console.warn(`[promo:milhao-gift] sem destinatários: ${campaign}`);
      continue;
    }

    const result = await dispatchExtraRoundMilhaoGiftCampaign({
      campaign,
      recipients,
      channels,
      grantTickets: !args.skipTickets,
      dryRun: args.dryRun,
    });
    summaries.push(result);

    console.info(`\n--- ${campaign} ---`);
    console.info("Destinatários (únicos):", result.recipients);
    if (args.dryRun) {
      console.info("Cotas: (dry-run — nada gravado no banco)");
    } else {
      console.info("Cotas:", result.tickets);
    }
    if (result.notify) {
      console.info("App (sininho):", result.notify.app.created);
      console.info("Push PWA:", result.notify.push);
      console.info("E-mail:", result.notify.email);
      console.info("Batch ID:", result.batchId);
    }
  }

  console.info("\n[promo:milhao-gift] concluído.", JSON.stringify(summaries, null, 2));

  const anyTicketFail = summaries.some((s) => s.tickets.failed > 0);
  const anyEmailFail = summaries.some((s) => (s.notify?.email.failed ?? 0) > 0);
  if (anyTicketFail || anyEmailFail) process.exit(1);
}

main()
  .catch((e) => {
    console.error("[promo:milhao-gift] falhou", e);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      /* ignore */
    }
  });
