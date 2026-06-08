/**
 * Cria (ou reseta) uma conta de teste com cota paga.
 * Run: npx tsx --tsconfig tsconfig.scripts.json scripts/seed-test-user.ts
 */
import { getPool } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { randomUUID } from "crypto";

const EMAIL = "teste@bolao.com";
const PASSWORD = "Teste@2026";
const NAME = "Usuário Teste";
const CPF = "12345678901";
const PHONE = "11999990001";

async function main() {
  const pool = getPool();

  // ── 1. Upsert user ──────────────────────────────────────────────────
  const hash = await hashPassword(PASSWORD);

  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE email = lower(trim($1))",
    [EMAIL],
  );

  let userId: string;

  if (existing.rows.length > 0) {
    userId = existing.rows[0]!.id;
    await pool.query(
      "UPDATE users SET password_hash = $1, email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $2",
      [hash, userId],
    );
    console.log(`[OK] Usuário já existe — senha resetada. id=${userId}`);
  } else {
    const code = `TEST${Date.now().toString(36).toUpperCase()}`;
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users
         (email, cpf, password_hash, name, phone, referral_code, avatar_index, email_verified_at)
       VALUES (lower(trim($1)), $2, $3, $4, $5, $6, 0, NOW())
       RETURNING id`,
      [EMAIL, CPF, hash, NAME, PHONE, code],
    );
    userId = rows[0]!.id;
    console.log(`[OK] Usuário criado. id=${userId}`);
  }

  // ── 2. Tickets pagos ────────────────────────────────────────────────
  const { rows: existingTickets } = await pool.query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM tickets WHERE user_id = $1 AND status = 'paid'",
    [userId],
  );

  if (Number(existingTickets[0]!.count) > 0) {
    console.log(`[OK] Usuário já tem ${existingTickets[0]!.count} cota(s) paga(s) — nada a fazer.`);
  } else {
    const ref = `seed_${randomUUID()}`;

    const { rows: tRows } = await pool.query<{ id: string }>(
      `INSERT INTO tickets
         (user_id, ticket_type, extra_championship_id, round_number,
          unit_price_cents, quantity, total_amount_cents, is_promo_bonus, status, external_ref)
       VALUES ($1, 'general', null, null, 2990, 1, 2990, false, 'paid', $2)
       RETURNING id`,
      [userId, ref],
    );
    const ticketId = tRows[0]!.id;

    await pool.query(
      `INSERT INTO transactions
         (user_id, ticket_id, ticket_type, provider, status, amount_cents, payment_method, external_ref, raw_request)
       VALUES ($1, $2, 'general', 'threexpay', 'paid', 2990, 'pix', $3, '{}'::jsonb)`,
      [userId, ticketId, ref],
    );
    console.log(`[OK] Criou 1 cota paga. ticket_id=${ticketId}`);
  }

  console.log("\n─────────────────────────────");
  console.log("  CONTA DE TESTE");
  console.log("─────────────────────────────");
  console.log(`  Email:  ${EMAIL}`);
  console.log(`  Senha:  ${PASSWORD}`);
  console.log(`  ID:     ${userId!}`);
  console.log("─────────────────────────────\n");

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
