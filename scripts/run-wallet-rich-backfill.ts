import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPool } from "@/lib/db";

async function main() {
  const sql = readFileSync(
    join(process.cwd(), "scripts/sql/20260625-wallet-rich-backfill.sql"),
    "utf8"
  );
  const pool = getPool();
  await pool.query(sql);

  // Verificação da invariante por usuário.
  const { rows: drift } = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM users u
       LEFT JOIN (SELECT user_id, sum(amount_cents) AS s FROM wallet_ledger GROUP BY user_id) l
         ON l.user_id = u.id
      WHERE COALESCE(u.balance_cents,0) <> COALESCE(l.s,0)`
  );
  const { rows: byType } = await pool.query<{ type: string; n: string }>(
    `SELECT type, count(*)::text AS n FROM wallet_ledger GROUP BY type ORDER BY type`
  );

  console.log("[backfill] ledger por tipo:");
  for (const r of byType) console.log(`  ${r.type}: ${r.n}`);
  const drifted = Number(drift[0]?.n ?? "0");
  if (drifted === 0) {
    console.log("[backfill] ✅ invariante OK — saldo == ledger para todos os usuários.");
  } else {
    console.error(`[backfill] ❌ ${drifted} usuário(s) com divergência! Rode npm run verify:wallet.`);
    process.exitCode = 1;
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
