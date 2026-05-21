/**
 * Aplica scripts/sql/20260522-password-reset-codes.sql no Postgres configurado no .env
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/run-password-reset-migration.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env" });

import { getPool } from "../lib/db";

async function main() {
  const sqlPath = join(process.cwd(), "scripts/sql/20260522-password-reset-codes.sql");
  const sql = readFileSync(sqlPath, "utf8");
  const pool = getPool();
  await pool.query(sql);
  console.info("[migration] password_reset_codes — OK");
  await pool.end();
}

main().catch((e) => {
  console.error("[migration] falhou", e);
  process.exit(1);
});
