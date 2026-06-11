/**
 * Concede 1 cota paga do Bolão dos Artilheiros para mario@gmail.com (teste).
 * Run: npx tsx --tsconfig tsconfig.scripts.json scripts/grant-mario-artilheiros-ticket.ts
 */
import "dotenv/config";
import { getPool } from "@/lib/db";
import { getArtilheirosTicketPriceCents } from "@/lib/artilheiros/config";

const EMAIL = "mario@gmail.com";

async function ensureTicketTypeConstraints() {
  const pool = getPool();
  await pool.query(`
    ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_ticket_type_check;
    ALTER TABLE tickets ADD CONSTRAINT tickets_ticket_type_check
      CHECK (ticket_type::text IN ('general', 'daily', 'extra', 'artilheiros'));
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'transactions_ticket_type_check'
      ) THEN
        ALTER TABLE transactions DROP CONSTRAINT transactions_ticket_type_check;
        ALTER TABLE transactions ADD CONSTRAINT transactions_ticket_type_check
          CHECK (ticket_type::text IN ('general', 'daily', 'extra', 'artilheiros'));
      END IF;
    END $$;
  `);
  console.log("[OK] CHECK constraints atualizados para artilheiros");
}

async function main() {
  const pool = getPool();
  await ensureTicketTypeConstraints();
  const price = getArtilheirosTicketPriceCents();
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");

  const { rows: users } = await pool.query<{ id: string; email: string }>(
    "SELECT id, email FROM users WHERE lower(trim(email)) = lower(trim($1)) LIMIT 1",
    [EMAIL],
  );
  const mario = users[0];
  if (!mario) throw new Error(`Usuário ${EMAIL} não encontrado`);

  console.log(`\n=== ${mario.email} ===`);
  console.log(`id: ${mario.id}`);

  const { rows: existing } = await pool.query<{ id: string; paid_at: Date | null }>(
    `SELECT id, paid_at FROM tickets
     WHERE user_id = $1 AND ticket_type = 'artilheiros' AND status = 'paid'
     ORDER BY COALESCE(paid_at, created_at) ASC`,
    [mario.id],
  );

  if (existing.length > 0) {
    const ticketId = existing[0]!.id;
    const { rows: linkRows } = await pool.query<{ transaction_id: string | null }>(
      "SELECT transaction_id FROM tickets WHERE id = $1",
      [ticketId],
    );
    if (!linkRows[0]?.transaction_id) {
      const ref = `mario_artilheiros_${Date.now()}`;
      const { rows: txRows } = await pool.query<{ id: string }>(
        `INSERT INTO transactions (
           user_id, ticket_id, ticket_type, provider, status, amount_cents,
           payment_method, external_ref, raw_request
         ) VALUES ($1, $2, 'artilheiros', 'threexpay', 'paid', $3, 'pix', $4, '{}'::jsonb)
         RETURNING id`,
        [mario.id, ticketId, price, `${ref}_tx`],
      );
      await pool.query(
        "UPDATE tickets SET transaction_id = $1, updated_at = now() WHERE id = $2",
        [txRows[0]!.id, ticketId],
      );
      console.log(`[FIX] Transação vinculada: ${txRows[0]!.id}`);
    }
    console.log(`\n[OK] Já possui cota artilheiros paga: ${ticketId}`);
    printUrls(appUrl, ticketId);
    await pool.end();
    return;
  }

  const ref = `mario_artilheiros_${Date.now()}`;

  const { rows: ticketRows } = await pool.query<{ id: string }>(
    `INSERT INTO tickets (
       user_id, ticket_type, extra_championship_id, round_number,
       unit_price_cents, quantity, total_amount_cents, is_promo_bonus,
       status, external_ref, paid_at
     ) VALUES ($1, 'artilheiros', null, null, $2, 1, $2, false, 'paid', $3, now())
     RETURNING id`,
    [mario.id, price, ref],
  );
  const ticketId = ticketRows[0]!.id;

  const { rows: txRows } = await pool.query<{ id: string }>(
    `INSERT INTO transactions (
       user_id, ticket_id, ticket_type, provider, status, amount_cents,
       payment_method, external_ref, raw_request
     ) VALUES ($1, $2, 'artilheiros', 'threexpay', 'paid', $3, 'pix', $4, '{}'::jsonb)
     RETURNING id`,
    [mario.id, ticketId, price, `${ref}_tx`],
  );
  const txId = txRows[0]!.id;

  await pool.query(
    "UPDATE tickets SET transaction_id = $1, updated_at = now() WHERE id = $2",
    [txId, ticketId],
  );

  console.log("\n[OK] Cota artilheiros criada (compra simulada)");
  console.log(`ticket_id: ${ticketId}`);
  console.log(`transaction_id: ${txId}`);
  console.log(`preço: R$ ${(price / 100).toFixed(2)}`);
  printUrls(appUrl, ticketId);

  await pool.end();
}

function printUrls(appUrl: string, ticketId: string) {
  console.log("\n=== Testar no app ===");
  console.log(`Bolões:   ${appUrl}/boloes`);
  console.log(`Palpites: ${appUrl}/palpites/artilheiros?ticket=${ticketId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
