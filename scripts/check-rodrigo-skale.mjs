import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config();

const EMAIL = "rodrigo@skalepay.com.br";
const SKALE_COMP = Number(process.env.SKALE_BOLAO_COMPETITION_ID || 90007);

const connStr = (process.env.DATABASE_URL ?? "").replace("sslmode=require", "sslmode=no-verify");
const pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

const userRes = await pool.query(
  `SELECT id::text, name, email, created_at FROM users WHERE lower(email) = lower($1) LIMIT 1`,
  [EMAIL],
);
const user = userRes.rows[0];
console.log("USER:", user ?? "NOT FOUND");
if (!user) {
  await pool.end();
  process.exit(1);
}

const tickets = await pool.query(
  `SELECT id::text, ticket_type, status, extra_championship_id, round_number,
          quantity, total_amount_cents, paid_at, created_at, external_ref,
          COALESCE(is_promo_bonus, false) AS is_promo_bonus
   FROM tickets WHERE user_id::text = $1 ORDER BY created_at DESC`,
  [user.id],
);
console.log("TICKETS:", tickets.rows.length);

for (const t of tickets.rows) {
  const preds = await pool.query(
    `SELECT COUNT(*)::int AS c FROM predictions WHERE ticket_id::text = $1`,
    [t.id],
  );
  const pts = await pool.query(
    `SELECT COALESCE(SUM(points),0)::int AS p FROM prediction_scores WHERE ticket_id::text = $1`,
    [t.id],
  );
  console.log({
    id: t.id,
    type: t.ticket_type,
    status: t.status,
    extra: t.extra_championship_id,
    isSkale: Number(t.extra_championship_id) === SKALE_COMP,
    promo: t.is_promo_bonus,
    preds: preds.rows[0].c,
    points: pts.rows[0].p,
    paid_at: t.paid_at,
  });
}

const skaleMatches = await pool.query(
  `SELECT COUNT(*)::int AS c FROM matches_cache WHERE competition_id = $1`,
  [SKALE_COMP],
);
const copaMatches = await pool.query(
  `SELECT COUNT(DISTINCT match_id)::int AS c FROM matches_cache WHERE competition_id IN ($1, 72)`,
  [SKALE_COMP],
);
console.log("SKALE_MATCHES_CACHE:", skaleMatches.rows[0].c, "DISTINCT_WITH_COPA:", copaMatches.rows[0].c);

await pool.end();
