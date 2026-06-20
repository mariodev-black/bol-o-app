/**
 * Atualiza palpites Suíça x Bósnia (2ª rodada Copa) para gustavo.rezende122@gmail.com
 * no Bolão Skale integral (90007):
 *   Cota 01 → 2x1
 *   Cota 02 → 1x1
 * Recomputa pontuação e exibe ranking Skale.
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/fix-gustavo-sui-bos-palpites.ts
 */
import "dotenv/config";
import type { PoolClient } from "pg";
import { getPool } from "../lib/db";
import { calcPredictionPoints } from "../lib/predictions";
import { recomputePredictionScoreForPrediction } from "../lib/predictions/score-recompute";
import { getSkaleBolaoCompetitionId } from "../lib/boloes/skale-config";

const EMAIL = "gustavo.rezende122@gmail.com";
const MATCH_ID = 27376;

/** Cota 01 = ticket mais antigo do Skale integral; Cota 02 = segundo. */
const COTAS: Array<{
  label: string;
  ticketId: string;
  scoreCasa: number;
  scoreVisitante: number;
}> = [
  {
    label: "Cota 01",
    ticketId: "7cc5dc0e-f7b3-4b9b-9625-32b3217bf6fd",
    scoreCasa: 2,
    scoreVisitante: 1,
  },
  {
    label: "Cota 02",
    ticketId: "37f1b92d-2459-4cf0-a4c5-81b5bd9f5ffc",
    scoreCasa: 1,
    scoreVisitante: 1,
  },
];

async function resolveSuiBosMatch(
  pool: ReturnType<typeof getPool>,
  compId: number,
): Promise<{
  match_id: number;
  home_name: string;
  away_name: string;
  status: string;
  result_casa: number | null;
  result_visitante: number | null;
  date_br: string | null;
  rodada: number | null;
}> {
  const { rows } = await pool.query<{
    match_id: number;
    home_name: string;
    away_name: string;
    status: string;
    result_casa: number | null;
    result_visitante: number | null;
    date_br: string | null;
    rodada: number | null;
  }>(
    `SELECT match_id, home_name, away_name, status, result_casa, result_visitante, date_br, rodada
       FROM matches_cache
      WHERE competition_id = $1
        AND match_id = $2
      LIMIT 1`,
    [compId, MATCH_ID],
  );
  const row = rows[0];
  if (!row) {
    const fallback = await pool.query<{ match_id: number }>(
      `SELECT match_id FROM matches_cache
       WHERE competition_id = $1
         AND home_name ILIKE '%su%'
         AND (away_name ILIKE '%bosn%' OR away_name ILIKE '%bósn%')
       ORDER BY kickoff_at DESC NULLS LAST
       LIMIT 1`,
      [compId],
    );
    const mid = fallback.rows[0]?.match_id;
    if (mid == null) {
      throw new Error(`Partida Suíça x Bósnia não encontrada (comp ${compId})`);
    }
    const retry = await pool.query(
      `SELECT match_id, home_name, away_name, status, result_casa, result_visitante, date_br, rodada
         FROM matches_cache WHERE competition_id = $1 AND match_id = $2`,
      [compId, mid],
    );
    if (!retry.rows[0]) throw new Error(`Match ${mid} não encontrado`);
    return retry.rows[0];
  }
  return row;
}

async function upsertPalpite(
  client: PoolClient,
  opts: {
    userId: string;
    ticketId: string;
    bolaoType: string;
    matchId: number;
    scoreCasa: number;
    scoreVisitante: number;
  },
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO predictions (user_id, ticket_id, bolao_type, match_id, score_casa, score_visitante)
     VALUES ($1::uuid, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, ticket_id, match_id)
     DO UPDATE SET score_casa = EXCLUDED.score_casa,
                   score_visitante = EXCLUDED.score_visitante,
                   updated_at = now()
     RETURNING id::text AS id`,
    [
      opts.userId,
      opts.ticketId,
      opts.bolaoType,
      opts.matchId,
      opts.scoreCasa,
      opts.scoreVisitante,
    ],
  );
  const predId = rows[0]?.id;
  if (!predId) throw new Error("Falha ao gravar palpite");
  await recomputePredictionScoreForPrediction(client, predId);
  return predId;
}

async function printSkaleRanking(
  pool: ReturnType<typeof getPool>,
  skaleComp: number,
  highlightUserId: string,
) {
  const { rows } = await pool.query<{
    pos: string;
    ticket_id: string;
    user_id: string;
    display_name: string | null;
    email: string;
    total_points: number;
    matches_scored: number;
  }>(
    `WITH totals AS (
       SELECT ps.ticket_id,
              t.user_id,
              COALESCE(SUM(ps.points), 0)::int AS total_points,
              COUNT(*)::int AS matches_scored
         FROM prediction_scores ps
         JOIN tickets t ON t.id::text = ps.ticket_id::text
        WHERE t.extra_championship_id = $1
          AND t.status IN ('paid', 'approved')
        GROUP BY ps.ticket_id, t.user_id
     ),
     ranked AS (
       SELECT ticket_id::text,
              user_id::text,
              total_points,
              matches_scored,
              ROW_NUMBER() OVER (
                ORDER BY total_points DESC, ticket_id ASC
              ) AS pos
         FROM totals
     )
     SELECT r.pos::text,
            r.ticket_id,
            r.user_id,
            u.name AS display_name,
            u.email,
            r.total_points,
            r.matches_scored
       FROM ranked r
       JOIN users u ON u.id::text = r.user_id
      ORDER BY r.pos::int ASC
      LIMIT 25`,
    [skaleComp],
  );

  console.log("=== Ranking Bolão Skale (top 25 por pontos) ===");
  for (const row of rows) {
    const mark =
      row.user_id === highlightUserId ? " ← Gustavo" : "";
    console.log(
      `  #${row.pos} ${row.display_name ?? row.email} — ${row.total_points} pts (${row.matches_scored} jogos) ticket ${row.ticket_id.slice(0, 8)}…${mark}`,
    );
  }
  console.log(`Total cotas pontuadas: ${rows.length}`);
}

async function main() {
  const pool = getPool();
  const client = await pool.connect();
  const skaleComp = getSkaleBolaoCompetitionId();

  try {
    const userRes = await client.query<{ id: string; name: string | null }>(
      `SELECT id::text AS id, name FROM users WHERE lower(email) = lower($1) LIMIT 1`,
      [EMAIL],
    );
    const user = userRes.rows[0];
    if (!user) throw new Error(`Usuário não encontrado: ${EMAIL}`);

    const match = await resolveSuiBosMatch(pool, skaleComp);
    const matchId = Number(match.match_id);

    console.log(`Usuário: ${user.name ?? ""} (${EMAIL})`);
    console.log(
      `Partida: ${match.home_name} x ${match.away_name} (#${matchId}, rodada ${match.rodada ?? "?"}, ${match.date_br ?? "?"})`,
    );
    console.log(
      `Resultado oficial: ${match.status} ${match.result_casa ?? "-"}x${match.result_visitante ?? "-"}`,
    );
    console.log(`Bolão Skale (comp ${skaleComp})\n`);

    await client.query("BEGIN");

    for (const cota of COTAS) {
      const ticketRes = await client.query<{
        id: string;
        user_id: string;
        ticket_type: string;
        status: string;
        extra_championship_id: number | null;
      }>(
        `SELECT id::text, user_id::text, ticket_type, status, extra_championship_id
           FROM tickets WHERE id::text = $1 LIMIT 1`,
        [cota.ticketId],
      );
      const ticket = ticketRes.rows[0];
      if (!ticket) throw new Error(`Ticket não encontrado: ${cota.ticketId}`);
      if (ticket.user_id !== user.id) {
        throw new Error(`${cota.label}: ticket ${cota.ticketId} não pertence a ${EMAIL}`);
      }
      if (Number(ticket.extra_championship_id) !== skaleComp) {
        throw new Error(
          `${cota.label}: ticket não é Bolão Skale integral (comp ${ticket.extra_championship_id})`,
        );
      }

      const predId = await upsertPalpite(client, {
        userId: user.id,
        ticketId: cota.ticketId,
        bolaoType: "extra",
        matchId,
        scoreCasa: cota.scoreCasa,
        scoreVisitante: cota.scoreVisitante,
      });

      const hasResult =
        match.result_casa != null && match.result_visitante != null;
      const calc = hasResult
        ? calcPredictionPoints(
            cota.scoreCasa,
            cota.scoreVisitante,
            match.result_casa as number,
            match.result_visitante as number,
          )
        : { points: 0, exact: false, outcomeHit: false, goalsHitCount: 0 };

      const totals = await client.query<{ total: number; matches: number }>(
        `SELECT COALESCE(SUM(points), 0)::int AS total, COUNT(*)::int AS matches
           FROM prediction_scores WHERE ticket_id = $1`,
        [cota.ticketId],
      );

      console.log(`--- ${cota.label} (${cota.ticketId}) ---`);
      console.log(
        `Palpite: ${cota.scoreCasa}x${cota.scoreVisitante} (prediction_id=${predId})`,
      );
      console.log(
        `Pontos nesta partida: ${calc.points} (exato=${calc.exact}, resultado=${calc.outcomeHit}, gols=${calc.goalsHitCount})`,
      );
      console.log(
        `Total ticket: ${totals.rows[0]?.total ?? 0} pts em ${totals.rows[0]?.matches ?? 0} jogos pontuados`,
      );
      console.log("");
    }

    await client.query("COMMIT");

    // Recomputa todos os palpites das cotas Skale (ranking alinhado).
    for (const cota of COTAS) {
      const predIdsRes = await client.query<{ id: string }>(
        `SELECT id::text AS id FROM predictions WHERE ticket_id = $1 ORDER BY match_id`,
        [cota.ticketId],
      );
      await client.query("BEGIN");
      for (const row of predIdsRes.rows) {
        await recomputePredictionScoreForPrediction(client, row.id);
      }
      await client.query("COMMIT");
      const totals = await pool.query<{ total: number; matches: number }>(
        `SELECT COALESCE(SUM(points), 0)::int AS total, COUNT(*)::int AS matches
           FROM prediction_scores WHERE ticket_id = $1`,
        [cota.ticketId],
      );
      console.log(
        `${cota.label}: ${predIdsRes.rows.length} palpites recomputados → total ${totals.rows[0]?.total ?? 0} pts (${totals.rows[0]?.matches ?? 0} jogos)`,
      );
    }
    console.log("");

    await printSkaleRanking(pool, skaleComp, user.id);
    console.log("\nConcluído.");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
