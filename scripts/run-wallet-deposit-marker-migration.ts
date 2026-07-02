import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPool } from "@/lib/db";

async function main() {
  const sql = readFileSync(
    join(process.cwd(), "scripts/sql/20260625-wallet-deposit-marker.sql"),
    "utf8"
  );
  const pool = getPool();
  await pool.query(sql);
  console.log("[migration] wallet deposit marker ok (purpose + ticket_id/ticket_type nullable)");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
