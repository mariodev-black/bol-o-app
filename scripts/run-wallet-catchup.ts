import "dotenv/config";
import { getPool } from "@/lib/db";

/**
 * Catch-up da carteira: fecha qualquer divergência entre o ledger e o saldo
 * real (`balance_cents` / `affiliate_balance_cents`) causada por eventos que
 * aconteceram em produção enquanto o código da carteira ainda não estava
 * deployado (prêmio/saque antigos mexendo direto na coluna).
 *
 * IMPORTANTE: isto NUNCA altera `balance_cents`/`affiliate_balance_cents`
 * (que refletem a realidade). Só insere a linha de ajuste que falta no
 * ledger para ele voltar a bater. Re-executável a qualquer momento antes do
 * deploy final — cada execução fecha só o que ainda estiver aberto.
 */
async function main() {
  const pool = getPool();
  const runId = new Date().toISOString();

  for (const account of ["wallet", "affiliate"] as const) {
    const column = account === "wallet" ? "balance_cents" : "affiliate_balance_cents";
    const { rows } = await pool.query<{
      user_id: string;
      balance_cents: string;
      ledger_sum: string;
      diff: string;
    }>(
      `WITH ledger_by_account AS (
         SELECT user_id, SUM(amount_cents) AS ledger_sum
         FROM wallet_ledger
         WHERE account = $1
         GROUP BY user_id
       )
       SELECT u.id::text AS user_id,
              COALESCE(u.${column}, 0)::text AS balance_cents,
              COALESCE(l.ledger_sum, 0)::text AS ledger_sum,
              (COALESCE(u.${column}, 0) - COALESCE(l.ledger_sum, 0))::text AS diff
         FROM users u
         LEFT JOIN ledger_by_account l ON l.user_id = u.id
        WHERE COALESCE(u.${column}, 0) <> COALESCE(l.ledger_sum, 0)`,
      [account]
    );

    if (rows.length === 0) {
      console.log(`[catchup] ${account}: nada a fazer, já bate.`);
      continue;
    }

    console.log(`[catchup] ${account}: ${rows.length} usuário(s) com divergência — ajustando…`);
    let applied = 0;
    for (const r of rows) {
      const diff = Number(r.diff);
      if (diff === 0) continue;
      const key = `catchup:${account}:${r.user_id}:${runId}`;
      const result = await pool.query(
        `INSERT INTO wallet_ledger (user_id, amount_cents, type, status, idempotency_key, balance_after, account, metadata)
         VALUES ($1::uuid, $2, 'adjustment', 'settled', $3, $4, $5, $6::jsonb)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          r.user_id,
          diff,
          key,
          Number(r.balance_cents),
          account,
          JSON.stringify({ source: "catchup", ranAt: runId, note: "eventos em prod antes do deploy da carteira" }),
        ]
      );
      if ((result.rowCount ?? 0) > 0) applied++;
    }
    console.log(`[catchup] ${account}: ${applied} linha(s) de ajuste inseridas.`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
