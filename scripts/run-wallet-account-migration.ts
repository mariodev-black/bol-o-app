import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPool } from "@/lib/db";

async function main() {
  const sql = readFileSync(
    join(process.cwd(), "scripts/sql/20260701-wallet-account-dimension.sql"),
    "utf8"
  );
  const pool = getPool();
  await pool.query(sql);

  const { rows } = await pool.query<{ account: string; n: string; sum: string }>(
    `SELECT account, count(*)::text AS n, COALESCE(sum(amount_cents),0)::text AS sum
       FROM wallet_ledger GROUP BY account ORDER BY account`
  );
  console.log("[migration] wallet account dimension ok");
  for (const r of rows) console.log(`  account=${r.account}  linhas=${r.n}  soma=${r.sum}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
