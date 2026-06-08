import { getPool } from "@/lib/db";

const TX_ID = "67766989-6fc8-42a5-b6bb-c7aac22d5c60";
const TICKET_ID = "5b1421cd-c4f3-4532-8142-bb805bf40dd0";

async function main() {
  const pool = getPool();
  await pool.query("UPDATE transactions SET status='paid', updated_at=NOW() WHERE id=$1", [TX_ID]);
  await pool.query("UPDATE tickets SET status='paid', paid_at=NOW() WHERE id=$1", [TICKET_ID]);
  const { rows: tx } = await pool.query("SELECT status FROM transactions WHERE id=$1", [TX_ID]);
  const { rows: tk } = await pool.query("SELECT status FROM tickets WHERE id=$1", [TICKET_ID]);
  console.log("transaction:", tx[0]?.status);
  console.log("ticket:     ", tk[0]?.status);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
