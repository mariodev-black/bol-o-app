import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPool } from "@/lib/db";

async function main() {
  const sql = readFileSync(
    join(process.cwd(), "scripts/sql/20260612-withdrawal-status-processing.sql"),
    "utf8",
  );
  const pool = getPool();
  await pool.query(sql);
  const { rows } = await pool.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def
     FROM pg_constraint
     WHERE conname = 'affiliate_withdrawal_requests_status_check'`,
  );
  console.log("[migration] withdrawal status constraint ok:", rows[0]?.def);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
