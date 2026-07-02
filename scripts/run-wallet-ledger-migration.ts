import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPool } from "@/lib/db";

async function main() {
  const sql = readFileSync(join(process.cwd(), "scripts/sql/20260625-wallet-ledger.sql"), "utf8");
  const pool = getPool();
  await pool.query(sql);

  const { rows } = await pool.query<{ users: string; ledger_total: string; balance_total: string }>(
    `SELECT
       (SELECT count(*) FROM wallet_ledger)::text AS users,
       (SELECT COALESCE(sum(amount_cents), 0) FROM wallet_ledger)::text AS ledger_total,
       (SELECT COALESCE(sum(balance_cents), 0) FROM users)::text AS balance_total`
  );
  const r = rows[0];
  console.log("[migration] wallet ledger ok");
  console.log(`[migration] linhas no ledger: ${r?.users}`);
  console.log(`[migration] SUM(ledger)=${r?.ledger_total} | SUM(balance_cents)=${r?.balance_total}`);
  if (r && r.ledger_total !== r.balance_total) {
    console.warn("[migration] AVISO: totais divergem — rode `npm run verify:wallet` para detalhar.");
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
