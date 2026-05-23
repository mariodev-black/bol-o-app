/**
 * Remove um disparo admin_broadcast do banco (sininho + histórico + registro de e-mail).
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/delete-admin-broadcast-batch.ts <batchId> [preview]
 */
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env" });

import { getPool } from "../lib/db";

const batchId = process.argv[2]?.trim();
const previewFilter = process.argv[3]?.trim();

if (!batchId) {
  console.error("Uso: scripts/delete-admin-broadcast-batch.ts <batchId> [preview]");
  process.exit(1);
}

async function main() {
  const pool = getPool();
  const kindPattern = `%${batchId}%`;
  const campaignId = `admin_notif_${batchId}`;

  const countParams = previewFilter ? [kindPattern, previewFilter] : [kindPattern];
  const countSql = previewFilter
    ? `SELECT COUNT(*)::int AS n FROM user_notifications WHERE kind LIKE $1 AND preview = $2`
    : `SELECT COUNT(*)::int AS n FROM user_notifications WHERE kind LIKE $1`;

  const { rows: countRows } = await pool.query<{ n: number }>(countSql, countParams);
  console.info("[delete] user_notifications a apagar:", countRows[0]?.n ?? 0);

  const deleteSql = previewFilter
    ? `DELETE FROM user_notifications WHERE kind LIKE $1 AND preview = $2`
    : `DELETE FROM user_notifications WHERE kind LIKE $1`;

  const delNotif = await pool.query(deleteSql, countParams);
  console.info("[delete] user_notifications apagadas:", delNotif.rowCount);

  const delBatch = await pool.query(
    `DELETE FROM admin_notification_batches WHERE batch_id = $1`,
    [batchId],
  );
  console.info("[delete] admin_notification_batches:", delBatch.rowCount);

  const delSends = await pool.query(
    `DELETE FROM email_campaign_sends WHERE campaign_id = $1`,
    [campaignId],
  );
  console.info("[delete] email_campaign_sends:", delSends.rowCount);

  const delRun = await pool.query(
    `DELETE FROM email_campaign_runs WHERE campaign_id = $1`,
    [campaignId],
  );
  console.info("[delete] email_campaign_runs:", delRun.rowCount);

  await pool.end();
}

main().catch((e) => {
  console.error("[delete] falhou", e);
  process.exit(1);
});
