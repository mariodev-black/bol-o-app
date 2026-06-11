import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPool } from "@/lib/db";

async function main() {
  const sql = readFileSync(join(process.cwd(), "scripts/sql/20260611-cartwave-webhook.sql"), "utf8");
  const pool = getPool();
  await pool.query(sql);
  console.log("[migration] cartwave webhook ok");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
