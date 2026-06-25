/**
 * Corrige saques `paid` cujo cartwave_status ficou defasado (ex.: CREATED após SUCCESS).
 *
 * Uso: npm run cartwave:repair-withdrawal-status
 */
import "dotenv/config";
import { getPool } from "@/lib/db";
import { ensureWithdrawalStatusConstraint } from "@/lib/referrals/withdrawSchema";

async function main() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureWithdrawalStatusConstraint(client);

    const repaired = await client.query<{ id: string; cartwave_status: string }>(
      `UPDATE affiliate_withdrawal_requests w
       SET cartwave_status = 'SUCCESS'
       FROM cartwave_webhook_events e
       WHERE e.event_type = 'PIX_CASHOUT_SUCCESS'
         AND e.withdrawal_id = w.id
         AND w.status = 'paid'
         AND COALESCE(w.cartwave_status, '') NOT IN ('SUCCESS', 'REFUNDED')
       RETURNING w.id::text, w.cartwave_status`,
    );

    await client.query("COMMIT");
    console.log("[repair] constraint ok; rows fixed:", repaired.rowCount);
    for (const row of repaired.rows) {
      console.log(" ", row.id, "→", row.cartwave_status);
    }
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
