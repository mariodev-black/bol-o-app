import "dotenv/config";
import { getPool } from "../lib/db";
import { calcPredictionPoints } from "../lib/predictions";
import { getFootballMainCompetitionId } from "../lib/boloes-extra-config";

const TICKET = process.argv[2]?.trim() || "10a88d6b-76b8-4843-b46b-d12391332350";

async function main() {
  const pool = getPool();
  const comp = getFootballMainCompetitionId();

  const ticket = (
    await pool.query(
      `SELECT t.id::text, t.ticket_type, t.extra_championship_id, u.email, u.name
       FROM tickets t JOIN users u ON u.id = t.user_id WHERE t.id::text = $1`,
      [TICKET],
    )
  ).rows[0];
  if (!ticket) throw new Error("Ticket não encontrado");

  const compId =
    ticket.ticket_type === "extra" && ticket.extra_championship_id
      ? ticket.extra_championship_id
      : comp;

  const { rows } = await pool.query(
    `SELECT p.id::text AS prediction_id, p.match_id, p.score_casa, p.score_visitante,
            mc.home_name, mc.away_name, mc.status, mc.result_casa, mc.result_visitante,
            ps.points, ps.exact, ps.outcome_hit, ps.goals_hit_count, ps.computed_at
     FROM predictions p
     JOIN matches_cache mc ON mc.match_id = p.match_id AND mc.competition_id = $2
     LEFT JOIN prediction_scores ps ON ps.prediction_id = p.id
     WHERE p.ticket_id = $1
       AND (
         (mc.home_name ILIKE '%noru%' AND mc.away_name ILIKE '%sene%')
         OR (mc.home_name ILIKE '%urug%' AND mc.away_name ILIKE '%cabo%')
       )
     ORDER BY p.match_id`,
    [TICKET, compId],
  );

  const totals = (
    await pool.query(
      `SELECT COALESCE(SUM(points),0)::int total, COUNT(*)::int matches
       FROM prediction_scores WHERE ticket_id = $1`,
      [TICKET],
    )
  ).rows[0];

  console.log("Ticket:", TICKET);
  console.log("Usuario:", ticket.name, ticket.email);
  console.log("---");
  let allOk = true;
  for (const r of rows) {
    const expected =
      r.result_casa != null && r.result_visitante != null
        ? calcPredictionPoints(
            r.score_casa,
            r.score_visitante,
            r.result_casa,
            r.result_visitante,
          )
        : { points: 0, exact: false };
    const ok = r.points === expected.points;
    if (!ok) allOk = false;
    console.log({
      jogo: `${r.home_name} x ${r.away_name}`,
      match_id: r.match_id,
      palpite: `${r.score_casa}x${r.score_visitante}`,
      resultado: `${r.result_casa}x${r.result_visitante}`,
      status: r.status,
      pontos_gravados: r.points,
      pontos_esperados: expected.points,
      ok,
      exact: r.exact,
    });
  }
  console.log("---");
  console.log(
    `Total ticket: ${totals.total} pts em ${totals.matches} jogos pontuados`,
  );

  const orphan = (
    await pool.query(
      `SELECT COUNT(*)::int c FROM predictions p
       LEFT JOIN prediction_scores ps ON ps.prediction_id = p.id
       WHERE p.ticket_id = $1 AND ps.prediction_id IS NULL`,
      [TICKET],
    )
  ).rows[0].c;
  console.log("Palpites sem score materializado:", orphan);
  console.log(allOk && orphan === 0 ? "\n✓ Tudo consistente" : "\n✗ Inconsistência detectada");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
