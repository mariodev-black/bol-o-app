/**
 * Adiciona a coluna users.nickname (apelido exibido no ranking).
 * Idempotente. Run:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/run-nickname-migration.ts
 */
import "dotenv/config";
import { getPool } from "@/lib/db";

async function main() {
  const pool = getPool();
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT`);
  console.log("[ok] coluna users.nickname garantida");
  await pool.end();
}

main().catch((err) => {
  console.error("[falha] migration nickname:", err);
  process.exit(1);
});
