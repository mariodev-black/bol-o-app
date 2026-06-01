/**
 * Confere CSV (pos 4–100) vs cotas `milhao_gift:*` no banco.
 *
 *   npm run promo:milhao-gift:verify
 */
import { config as dotenvConfig } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";

dotenvConfig({ path: ".env" });

import { getPool } from "../lib/db";
import type { ExtraRoundMilhaoGiftCampaign } from "../lib/promotions/extra-round-milhao-gift";

const POS_MIN = 4;
const POS_MAX = 100;

const CSVS: Record<ExtraRoundMilhaoGiftCampaign, string> = {
  brasileirao_r18:
    "scripts/output/extra-ranking-top100-comp10-r18-brasileirao-18-rodada.csv",
  libertadores_r6:
    "scripts/output/extra-ranking-top100-comp7-r6-libertadores-6-rodada.csv",
};

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

function loadUniqueRecipients(path: string): {
  allRows: number;
  unique: Array<{ userId: string; position: number; email: string }>;
  excludedTop3: number;
} {
  const raw = readFileSync(path, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const posIdx = header.indexOf("posicao");
  const userIdx = header.indexOf("user_id");
  const emailIdx = header.indexOf("email");

  let allRows = 0;
  let excludedTop3 = 0;
  const byUser = new Map<string, { userId: string; position: number; email: string }>();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]!);
    const pos = Number.parseInt(cols[posIdx] ?? "", 10);
    const userId = (cols[userIdx] ?? "").trim();
    const email = emailIdx >= 0 ? (cols[emailIdx] ?? "").trim() : "";
    if (!userId || !Number.isFinite(pos)) continue;
    if (pos >= 1 && pos <= 3) {
      excludedTop3 += 1;
      continue;
    }
    if (pos < POS_MIN || pos > POS_MAX) continue;
    allRows += 1;
    const prev = byUser.get(userId);
    if (!prev || pos < prev.position) {
      byUser.set(userId, { userId, position: pos, email });
    }
  }

  return { allRows, unique: [...byUser.values()], excludedTop3 };
}

async function main() {
  const pool = getPool();
  let ok = true;

  console.log("Verificação prêmio Milhão (pos 4–100)\n");

  for (const [campaign, relPath] of Object.entries(CSVS) as Array<
    [ExtraRoundMilhaoGiftCampaign, string]
  >) {
    const path = join(process.cwd(), relPath);
    const { allRows, unique, excludedTop3 } = loadUniqueRecipients(path);
    const refs = unique.map((u) => `milhao_gift:${campaign}:${u.userId}`);

    const { rows: ticketRows } = await pool.query<{
      external_ref: string;
      ticket_type: string;
      is_promo_bonus: boolean;
    }>(
      `SELECT external_ref, ticket_type, is_promo_bonus
       FROM tickets
       WHERE external_ref = ANY($1::text[])
         AND status IN ('paid', 'approved')`,
      [refs],
    );

    const missing = unique.filter(
      (u) => !ticketRows.some((t) => t.external_ref === `milhao_gift:${campaign}:${u.userId}`),
    );
    const badType = ticketRows.filter((t) => t.ticket_type !== "general");
    const badPromo = ticketRows.filter((t) => !t.is_promo_bonus);

    console.log(`=== ${campaign} ===`);
    console.log(`  CSV: ${allRows} linhas pos 4–100 (${excludedTop3} excluídas do top 3)`);
    console.log(`  Usuários únicos: ${unique.length}${allRows > unique.length ? ` (${allRows - unique.length} duplicata no CSV)` : ""}`);
    console.log(`  Cotas no banco: ${ticketRows.length} / ${unique.length}`);
    if (missing.length) {
      ok = false;
      console.log(`  ❌ Sem cota (${missing.length}):`, missing.slice(0, 5).map((m) => m.email));
    }
    if (badType.length || badPromo.length) {
      ok = false;
      console.log("  ❌ Cotas com tipo/promo incorreto");
    }
    if (missing.length === 0 && badType.length === 0 && badPromo.length === 0) {
      console.log("  ✅ Cotas OK (general, is_promo_bonus, paid)");
    }
    console.log("");
  }

  const br = loadUniqueRecipients(join(process.cwd(), CSVS.brasileirao_r18)).unique;
  const lib = loadUniqueRecipients(join(process.cwd(), CSVS.libertadores_r6)).unique;
  const brIds = new Set(br.map((u) => u.userId));
  const both = lib.filter((u) => brIds.has(u.userId));
  console.log(`Usuários nas duas campanhas: ${both.length} (recebem 2 cotas grátis — uma por rodada)`);

  await pool.end();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
