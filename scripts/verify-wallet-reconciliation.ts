import "dotenv/config";
import { getPool } from "@/lib/db";

/**
 * Reconciliação da carteira: garante, para CADA conta, a invariante
 *   SUM(wallet_ledger.amount_cents WHERE account='wallet')    == users.balance_cents
 *   SUM(wallet_ledger.amount_cents WHERE account='affiliate') == users.affiliate_balance_cents
 *
 * O usuário vê 1 saldo só (soma das 2), mas cada conta é auditada separado.
 * Qualquer divergência indica bug em algum fluxo que mexeu no saldo sem
 * passar pelo ledger. Sai com código 1 se houver divergência.
 */
async function main() {
  const pool = getPool();

  const { rows } = await pool.query<{
    user_id: string;
    account: string;
    balance_cents: string;
    ledger_sum: string;
    diff: string;
  }>(
    `WITH ledger_by_account AS (
       SELECT user_id, account, SUM(amount_cents) AS ledger_sum
       FROM wallet_ledger
       GROUP BY user_id, account
     ),
     diffs AS (
       SELECT u.id::text AS user_id, 'wallet' AS account,
              COALESCE(u.balance_cents, 0)::bigint AS balance_cents,
              COALESCE(l.ledger_sum, 0)::bigint AS ledger_sum
         FROM users u
         LEFT JOIN ledger_by_account l ON l.user_id = u.id AND l.account = 'wallet'
        WHERE COALESCE(u.balance_cents, 0) <> COALESCE(l.ledger_sum, 0)
       UNION ALL
       SELECT u.id::text AS user_id, 'affiliate' AS account,
              COALESCE(u.affiliate_balance_cents, 0)::bigint AS balance_cents,
              COALESCE(l.ledger_sum, 0)::bigint AS ledger_sum
         FROM users u
         LEFT JOIN ledger_by_account l ON l.user_id = u.id AND l.account = 'affiliate'
        WHERE COALESCE(u.affiliate_balance_cents, 0) <> COALESCE(l.ledger_sum, 0)
     )
     SELECT user_id, account, balance_cents::text, ledger_sum::text,
            (balance_cents - ledger_sum)::text AS diff
       FROM diffs
      ORDER BY abs(balance_cents - ledger_sum) DESC`
  );

  const { rows: totalsRows } = await pool.query<{
    users: string;
    wallet_total: string;
    affiliate_total: string;
    ledger_wallet_total: string;
    ledger_affiliate_total: string;
  }>(
    `SELECT
       (SELECT count(*) FROM users)::text AS users,
       (SELECT COALESCE(sum(balance_cents), 0) FROM users)::text AS wallet_total,
       (SELECT COALESCE(sum(affiliate_balance_cents), 0) FROM users)::text AS affiliate_total,
       (SELECT COALESCE(sum(amount_cents), 0) FROM wallet_ledger WHERE account = 'wallet')::text AS ledger_wallet_total,
       (SELECT COALESCE(sum(amount_cents), 0) FROM wallet_ledger WHERE account = 'affiliate')::text AS ledger_affiliate_total`
  );
  const totals = totalsRows[0];

  console.log("=== Reconciliação da carteira (2 contas: wallet + affiliate) ===");
  console.log(`Usuários: ${totals?.users}`);
  console.log(`SUM(balance_cents)            = ${totals?.wallet_total}`);
  console.log(`SUM(ledger account=wallet)     = ${totals?.ledger_wallet_total}`);
  console.log(`SUM(affiliate_balance_cents)   = ${totals?.affiliate_total}`);
  console.log(`SUM(ledger account=affiliate)  = ${totals?.ledger_affiliate_total}`);

  if (rows.length === 0) {
    console.log("✅ OK — saldo bate com o ledger (nas 2 contas) para todos os usuários.");
    await pool.end();
    return;
  }

  console.error(`❌ DIVERGÊNCIA em ${rows.length} linha(s):`);
  for (const r of rows.slice(0, 50)) {
    console.error(
      `  user=${r.user_id}  account=${r.account}  balance=${r.balance_cents}  ledger=${r.ledger_sum}  diff=${r.diff}`
    );
  }
  if (rows.length > 50) console.error(`  ... e mais ${rows.length - 50}.`);

  await pool.end();
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
