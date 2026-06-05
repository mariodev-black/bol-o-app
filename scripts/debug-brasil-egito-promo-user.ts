/**
 * Debug promo Brasil x Egito para um usuário (por referral_code ou email).
 * Uso: npx tsx scripts/debug-brasil-egito-promo-user.ts DDW6ZT
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

import { getPool } from "../lib/db";
import { getBrasilEgitoPlacarPromoStatusForUser, BRASIL_EGITO_PLACAR_MATCH_ID } from "../lib/promotions/brasil-egito-placar-promo";

const BRASIL_EGITO_MATCH_ID = BRASIL_EGITO_PLACAR_MATCH_ID;
const lookup = process.argv[2]?.trim() || "DDW6ZT";

async function main() {
  const pool = getPool();
  const { rows: users } = await pool.query<{
    id: string;
    email: string;
    referral_code: string | null;
  }>(
    `SELECT id, email, referral_code FROM users
     WHERE referral_code = $1 OR email ILIKE $1
     LIMIT 5`,
    [lookup],
  );

  if (users.length === 0) {
    console.log("Nenhum usuário encontrado para:", lookup);
    process.exit(1);
  }

  for (const user of users) {
    console.log("\n=== Usuário ===");
    console.log({ id: user.id, email: user.email, referral_code: user.referral_code });

    const { rows: promoRows } = await pool.query(
      `SELECT pred_casa, pred_visitante, created_at
       FROM brasil_egito_placar_promo_submissions WHERE user_id = $1::uuid`,
      [user.id],
    );
    console.log("\n--- brasil_egito_placar_promo_submissions ---");
    console.log(promoRows.length ? promoRows : "(vazio)");

    const { rows: predRows } = await pool.query(
      `SELECT p.match_id, p.score_casa, p.score_visitante, p.bolao_type,
              t.status, t.is_promo_bonus, t.extra_championship_id
       FROM predictions p
       INNER JOIN tickets t ON t.id::text = p.ticket_id
       WHERE p.user_id = $1::uuid
       ORDER BY p.submitted_at DESC
       LIMIT 20`,
      [user.id],
    );
    console.log("\n--- predictions (últimas 20) ---");
    console.log(JSON.stringify(predRows, null, 2));

    const { rows: brasilEgitoPred } = await pool.query(
      `SELECT p.score_casa, p.score_visitante, p.bolao_type, t.status, t.is_promo_bonus
       FROM predictions p
       INNER JOIN tickets t ON t.id::text = p.ticket_id
       WHERE p.user_id = $1::uuid AND p.match_id = $2`,
      [user.id, BRASIL_EGITO_MATCH_ID],
    );
    console.log("\n--- prediction Brasil x Egito (match", BRASIL_EGITO_MATCH_ID, ") ---");
    console.log(brasilEgitoPred.length ? brasilEgitoPred : "(vazio)");

    const { rows: byBonus } = await pool.query(
      `SELECT COALESCE(t.is_promo_bonus, false) AS promo_bonus, COUNT(*)::int AS n
       FROM predictions p
       INNER JOIN tickets t ON t.id::text = p.ticket_id
       WHERE p.user_id = $1::uuid AND t.status IN ('paid', 'approved')
       GROUP BY 1`,
      [user.id],
    );
    console.log("\n--- predictions por is_promo_bonus ---");
    console.log(byBonus);

    const { rows: byBolao } = await pool.query(
      `SELECT p.bolao_type, t.extra_championship_id, COUNT(*)::int AS n
       FROM predictions p
       INNER JOIN tickets t ON t.id::text = p.ticket_id
       WHERE p.user_id = $1::uuid
         AND t.status IN ('paid', 'approved')
         AND NOT COALESCE(t.is_promo_bonus, false)
       GROUP BY 1, 2
       ORDER BY n DESC`,
      [user.id],
    );
    console.log("\n--- non-promo predictions por bolao_type ---");
    console.log(byBolao);

    const { rows: countRows } = await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n
       FROM predictions p
       INNER JOIN tickets t ON t.id::text = p.ticket_id
       WHERE p.user_id = $1::uuid
         AND t.status IN ('paid', 'approved')
         AND NOT COALESCE(t.is_promo_bonus, false)`,
      [user.id],
    );
    console.log("\n--- countUserBolaoPredictions (hasBet source) ---");
    console.log({ count: countRows[0]?.n ?? 0 });

    const status = await getBrasilEgitoPlacarPromoStatusForUser(user.id);
    console.log("\n--- getBrasilEgitoPlacarPromoStatusForUser ---");
    console.log(JSON.stringify(status, null, 2));
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
