import "dotenv/config";
import { getPool } from "@/lib/db";

/**
 * Reclassifica os 18 lançamentos genéricos 'catchup:wallet:*' (criados pelo
 * script de catch-up em 2026-07-02) em linhas itemizadas de verdade —
 * 'prize' por prêmio real + 'withdrawal' para os 3 saques ainda pendentes
 * do código antigo (débito já aconteceu no saldo real, sem registro no
 * ledger). NÃO altera balance_cents em nenhum momento — só troca 1 linha
 * genérica por N linhas itemizadas com a MESMA soma líquida (verificado
 * até o centavo antes de escrever qualquer coisa).
 *
 * Atômico: tudo numa transação. Se qualquer verificação falhar, ROLLBACK.
 */
async function main() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: adjustments } = await client.query<{
      id: string;
      user_id: string;
      amount_cents: string;
      created_at: Date;
    }>(
      `SELECT id, user_id::text AS user_id, amount_cents::text, created_at
         FROM wallet_ledger
        WHERE type = 'adjustment' AND account = 'wallet' AND idempotency_key LIKE 'catchup:wallet:%'
        ORDER BY user_id
        FOR UPDATE`
    );

    let totalReplaced = 0;
    for (const adj of adjustments) {
      const userId = adj.user_id;
      const adjAmount = Number(adj.amount_cents);

      const { rows: prizes } = await client.query<{ id: string; amount_cents: number; created_at: Date }>(
        `SELECT t.id::text AS id, t.amount_cents, t.created_at
           FROM transactions t
          WHERE t.user_id = $1::uuid AND t.provider = 'internal_prize' AND t.status IN ('paid','approved')
            AND NOT EXISTS (
              SELECT 1 FROM wallet_ledger l WHERE l.idempotency_key = 'prize:legacy:' || t.id::text
            )`,
        [userId]
      );

      const { rows: pendingWithdrawals } = await client.query<{ id: string; amount_cents: number; created_at: Date }>(
        `SELECT w.id::text AS id, w.amount_cents, w.created_at
           FROM affiliate_withdrawal_requests w
          WHERE w.user_id = $1::uuid AND w.balance_source = 'wallet' AND w.status IN ('approved','paid')
            AND NOT EXISTS (
              SELECT 1 FROM wallet_ledger l
               WHERE l.idempotency_key IN ('withdrawal:' || w.id::text, 'withdrawal:' || w.id::text || ':wallet')
            )
          UNION ALL
          SELECT w.id::text AS id, w.amount_cents, w.created_at
           FROM affiliate_withdrawal_requests w
          WHERE w.user_id = $1::uuid AND w.balance_source = 'wallet' AND w.status = 'pending'
            AND NOT EXISTS (
              SELECT 1 FROM wallet_ledger l
               WHERE l.idempotency_key IN ('withdrawal:' || w.id::text, 'withdrawal:' || w.id::text || ':wallet')
            )`,
        [userId]
      );

      const prizeSum = prizes.reduce((s, p) => s + p.amount_cents, 0);
      const debitSum = pendingWithdrawals.reduce((s, w) => s + w.amount_cents, 0);
      const netExplained = prizeSum - debitSum;

      if (netExplained !== adjAmount) {
        throw new Error(
          `Divergência para user=${userId}: adj=${adjAmount} explicado=${netExplained} — abortando tudo.`
        );
      }

      // Remove a linha genérica.
      await client.query(`DELETE FROM wallet_ledger WHERE id = $1::uuid`, [adj.id]);

      // Insere cada prêmio itemizado (mesmo padrão do backfill rico de 2026-06-25).
      for (const p of prizes) {
        await client.query(
          `INSERT INTO wallet_ledger (user_id, amount_cents, type, status, transaction_id, idempotency_key, balance_after, account, metadata, created_at)
           VALUES ($1::uuid, $2, 'prize', 'settled', $3::uuid, $4, 0, 'wallet', $5::jsonb, $6)
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [
            userId,
            p.amount_cents,
            p.id,
            `prize:legacy:${p.id}`,
            JSON.stringify({ source: "reclass_2026-07-02", note: "prêmio da janela sem deploy da carteira" }),
            p.created_at,
          ]
        );
      }

      // Insere o débito do saque pendente (origem antiga, ainda sem decisão do admin).
      for (const w of pendingWithdrawals) {
        await client.query(
          `INSERT INTO wallet_ledger (user_id, amount_cents, type, status, idempotency_key, balance_after, account, metadata, created_at)
           VALUES ($1::uuid, $2, 'withdrawal', 'settled', $3, 0, 'wallet', $4::jsonb, $5)
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [
            userId,
            -w.amount_cents,
            `withdrawal:${w.id}`,
            JSON.stringify({ source: "reclass_2026-07-02", note: "débito de saque da janela sem deploy da carteira", withdrawalId: w.id }),
            w.created_at,
          ]
        );
      }

      totalReplaced++;
      console.log(`✓ user=${userId}: 1 ajuste genérico → ${prizes.length} prêmio(s) + ${pendingWithdrawals.length} saque(s)`);
    }

    // Recalcula balance_after cumulativo (ordem cronológica) só do lado wallet.
    await client.query(`
      WITH ordered AS (
        SELECT id,
          sum(amount_cents) OVER (
            PARTITION BY user_id, account ORDER BY created_at, id
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ) AS running
        FROM wallet_ledger
        WHERE account = 'wallet'
      )
      UPDATE wallet_ledger w
      SET balance_after = o.running
      FROM ordered o
      WHERE o.id = w.id
    `);

    await client.query("COMMIT");
    console.log(`\n✅ ${totalReplaced} usuário(s) reclassificados com sucesso.`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Abortado (nada foi alterado):", error);
    process.exitCode = 1;
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
