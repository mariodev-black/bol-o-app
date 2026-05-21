/**
 * Aplica migrations de notificações no Postgres (.env).
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/run-notifications-migration.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env" });

import { getPool } from "../lib/db";

const FILES = [
  "20260523-user-notifications.sql",
  "20260524-user-notifications-bolao-promo.sql",
] as const;

async function main() {
  const pool = getPool();
  for (const name of FILES) {
    const sqlPath = join(process.cwd(), "scripts/sql", name);
    const sql = readFileSync(sqlPath, "utf8");
    await pool.query(sql);
    console.info("[migration]", name, "— OK");
  }
  await pool.end();
}

main().catch((e) => {
  console.error("[migration] falhou", e);
  process.exit(1);
});
