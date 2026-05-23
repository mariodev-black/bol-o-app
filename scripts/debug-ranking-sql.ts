/**
 * Consultas SQL do ranking extra (campeonato 10 = Brasileirão por padrão).
 * Uso: npm run debug:ranking-sql
 *      npm run debug:ranking-sql -- 69
 *      npm run debug:ranking-sql -- 10 --skip-leaderboard
 */
import { config as dotenvConfig } from "dotenv";
import { getPool } from "../lib/db";
import { buildLeaderboardExtraForTicketDebug } from "../lib/ranking/leaderboard";

dotenvConfig({ path: ".env" });

const argv = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("-")));
const comp = Number(argv[0]) || 10;
const skipLeaderboard = flags.has("--skip-leaderboard");

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  const out = await fn();
  console.log(`  (${label}: ${((Date.now() - t0) / 1000).toFixed(2)}s)`);
  return out;
}

async function main() {
  const pool = getPool();

  console.log("\n========== RANKING EXTRA — DEBUG SQL ==========");
  console.log("Campeonato (extra_championship_id):", comp);
  if (skipLeaderboard) console.log("(modo rápido: --skip-leaderboard)");

  await timed("ping DB", () => pool.query("SELECT 1"));

  const totals = await timed("contagens", () =>
    pool.query<{
      pagas: string;
      promo: string;
      total: string;
      promo_com_palpite: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE NOT COALESCE(t.is_promo_bonus, false)) AS pagas,
         COUNT(*) FILTER (WHERE COALESCE(t.is_promo_bonus, false)) AS promo,
         COUNT(*) AS total,
         COUNT(DISTINCT t.id) FILTER (
           WHERE COALESCE(t.is_promo_bonus, false)
             AND EXISTS (
               SELECT 1 FROM predictions p
               WHERE p.ticket_id::text = t.id::text AND p.bolao_type = 'extra'
             )
         ) AS promo_com_palpite
       FROM tickets t
       WHERE t.ticket_type = 'extra'
         AND t.extra_championship_id = $1
         AND t.status IN ('paid', 'approved')`,
      [comp],
    ),
  );
  console.log("\n--- Resumo cotas (ranking usa TODAS com includePromoBonus) ---");
  console.table(totals.rows);
  console.log(
    "  → Antes só entravam as",
    totals.rows[0]?.pagas,
    "pagas; com fix entram ~",
    totals.rows[0]?.total,
    "no ranking visual.",
  );

  const paid = await timed("cotas pagas", () =>
    pool.query(
    `SELECT t.id::text AS id, t.round_number, u.email, u.name,
            COUNT(p.id)::int AS palpites
     FROM tickets t
     JOIN users u ON u.id::text = t.user_id::text
     LEFT JOIN predictions p ON p.ticket_id::text = t.id::text AND p.bolao_type = 'extra'
     WHERE t.ticket_type = 'extra'
       AND t.extra_championship_id = $1
       AND t.status IN ('paid', 'approved')
       AND NOT COALESCE(t.is_promo_bonus, false)
     GROUP BY t.id, t.round_number, u.email, u.name
     ORDER BY palpites DESC`,
      [comp],
    ),
  );
  console.log("\n--- Cotas pagas (não promo) --- total:", paid.rowCount);
  console.table(paid.rows);

  const byUser = await pool.query(
    `SELECT u.email, u.name,
            COUNT(DISTINCT t.id)::int AS cotas,
            COUNT(p.id)::int AS palpites,
            string_agg(DISTINCT mc.rodada::text, ',' ORDER BY mc.rodada::text) AS rodadas_cache,
            string_agg(DISTINCT mc.date_br, ',' ORDER BY mc.date_br) AS datas_cache
     FROM tickets t
     JOIN users u ON u.id::text = t.user_id::text
     LEFT JOIN predictions p ON p.ticket_id::text = t.id::text AND p.bolao_type = 'extra'
     LEFT JOIN matches_cache mc
       ON mc.competition_id = $1 AND mc.match_id::text = p.match_id::text
     WHERE t.ticket_type = 'extra'
       AND t.extra_championship_id = $1
       AND t.status IN ('paid', 'approved')
       AND NOT COALESCE(t.is_promo_bonus, false)
     GROUP BY u.id, u.email, u.name
     ORDER BY palpites DESC`,
    [comp],
  );
  console.log("\n--- Agrupado por usuário ---");
  console.table(byUser.rows);

  const promoCount = await timed("count promo", () =>
    pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM tickets t
       WHERE t.ticket_type = 'extra' AND t.extra_championship_id = $1
         AND COALESCE(t.is_promo_bonus, false) = true
         AND t.status IN ('paid', 'approved')`,
      [comp],
    ),
  );
  console.log(
    "\n--- Cotas GRÁTIS (is_promo_bonus) — agora ENTRAM no ranking --- total:",
    promoCount.rows[0]?.n,
  );
  const promoSample = await pool.query(
    `SELECT t.id::text, u.email, COUNT(p.id)::int AS palpites
     FROM tickets t
     JOIN users u ON u.id::text = t.user_id::text
     LEFT JOIN predictions p ON p.ticket_id::text = t.id::text AND p.bolao_type = 'extra'
     WHERE t.ticket_type = 'extra'
       AND t.extra_championship_id = $1
       AND COALESCE(t.is_promo_bonus, false) = true
       AND t.status IN ('paid', 'approved')
     GROUP BY t.id, u.email
     ORDER BY palpites DESC
     LIMIT 8`,
    [comp],
  );
  console.log("(amostra top 8 por palpites)");
  console.table(promoSample.rows);

  const rodadaAtual = await pool.query(
    `SELECT rodada_atual_numero, rodada_atual_nome, nome
     FROM championships_cache WHERE competition_id = $1 LIMIT 1`,
    [comp],
  );
  console.log("\n--- championships_cache ---");
  console.log(rodadaAtual.rows[0] ?? "(sem snapshot)");

  const focusId = (paid.rows[0]?.id ?? promoSample.rows[0]?.id) as string | undefined;
  if (!focusId) {
    console.log("\nNenhuma cota para testar leaderboard.");
    return;
  }
  if (skipLeaderboard) {
    console.log("\nPulei leaderboard. Teste manual:");
    console.log(`  npm run debug:ranking-extra -- ${focusId}`);
    return;
  }

  console.log("\n--- Leaderboard API (ticket foco:", focusId, ") ---");
  const { rows, meta } = await timed("buildLeaderboardExtra", () =>
    buildLeaderboardExtraForTicketDebug(focusId),
  );
  console.log("meta.participantCount:", meta.participantCount);
  console.log("meta.revenueCents (só pagas):", meta.revenueCents);
  console.log("Top 15 + últimas 3 posições:");
  const preview = [
    ...rows.slice(0, 15),
    ...(rows.length > 18 ? [{ pos: "…" as const }] : []),
    ...rows.slice(-3),
  ];
  console.table(
    preview.map((r) =>
      r.pos === "…"
        ? { pos: "…", nome: `+${rows.length - 18} linhas`, acertos: "", pts: "", ticket: "" }
        : {
            pos: r.pos,
            nome: r.displayName,
            acertos: r.outcomeCount,
            pts: r.totalPoints,
            ticket: `${r.ticketId.slice(0, 8)}...`,
          },
    ),
  );

  const inLb = new Set(rows.map((r) => r.ticketId));
  const missing = paid.rows.filter((r) => !inLb.has(r.id as string));
  if (missing.length) {
    console.log("\n--- FORA do leaderboard ---");
    console.table(missing);
  } else {
    console.log("\n✓ Todas as cotas pagas estão no leaderboard.");
  }

  console.log("\nComando por cota:");
  for (const row of paid.rows.slice(0, 5)) {
    console.log(`  npm run debug:ranking-extra -- ${row.id}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
