import { config as dotenvConfig } from "dotenv";
import { getPool } from "../lib/db";

dotenvConfig({ path: ".env" });

async function main() {
  const pool = getPool();
  const r = await pool.query<{
    id: string;
    round_number: number | null;
    extra_championship_id: number;
    email: string;
    name: string | null;
    preds: number;
  }>(
    `SELECT t.id::text AS id,
            t.round_number,
            t.extra_championship_id,
            u.email,
            u.name,
            COUNT(p.id)::int AS preds
     FROM tickets t
     JOIN users u ON u.id::text = t.user_id::text
     LEFT JOIN predictions p ON p.ticket_id::text = t.id::text AND p.bolao_type = 'extra'
     WHERE t.ticket_type = 'extra'
       AND t.status IN ('paid', 'approved')
       AND NOT COALESCE(t.is_promo_bonus, false)
     GROUP BY t.id, t.round_number, t.extra_championship_id, u.email, u.name
     ORDER BY preds DESC, t.created_at DESC
     LIMIT 15`,
  );
  console.table(
    r.rows.map((row) => ({
      id: row.id.slice(0, 8) + "...",
      full_id: row.id,
      rodada: row.round_number,
      comp: row.extra_championship_id,
      palpites: row.preds,
      user: row.name ?? row.email,
    })),
  );
  if (r.rows[0]) {
    console.log("\nCopie para debug:");
    console.log(`npm run debug:ranking-extra -- ${r.rows[0].id}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
