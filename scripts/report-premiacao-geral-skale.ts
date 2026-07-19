import { config } from "dotenv";
config({ path: ".env" });

import { Pool } from "pg";
import { calculatePrizeAwards } from "@/lib/prizes/distribution";
import {
  getGeneralBolaoFixedParticipantCount,
  getGeneralBolaoFixedPoolCents,
  getGeneralBolaoFixedWinnerCount,
} from "@/lib/prizes/general-bolao-fixed-prize";
import {
  calculateSkalePrizeAwards,
  calculateSkalePrizePoolCents,
} from "@/lib/boloes/skale-prize";

const pool = new Pool({
  host: process.env.DATABASE_HOST === "localhost" ? "147.93.145.150" : process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 5432),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  connectionTimeoutMillis: 15000,
});

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

type RankingRow = {
  ticket_id: string;
  nome: string;
  email: string;
  total_points: number;
  exact_hits: number;
  outcome_hits: number;
  matches_picked: number;
  total_amount_cents: number;
  paid_at: string | null;
  settled_at: string | null;
};

async function rankingQuery(
  client: Awaited<ReturnType<typeof pool.connect>>,
  type: "general" | "skale",
): Promise<RankingRow[]> {
  const where =
    type === "general"
      ? "t.ticket_type = 'general' AND t.bolao_definition_id IS NULL"
      : "t.ticket_type = 'extra' AND t.extra_championship_id = 90007 AND t.bolao_definition_id IS NULL";

  const { rows } = await client.query<RankingRow>(`
    SELECT
      t.id::text AS ticket_id,
      COALESCE(u.name, split_part(u.email,'@',1)) AS nome,
      u.email,
      COALESCE(SUM(ps.points),0)::int AS total_points,
      COUNT(*) FILTER (WHERE ps.exact IS TRUE)::int AS exact_hits,
      COUNT(*) FILTER (WHERE ps.outcome_hit IS TRUE)::int AS outcome_hits,
      COUNT(DISTINCT p.match_id)::int AS matches_picked,
      t.total_amount_cents,
      t.paid_at,
      t.settled_at
    FROM tickets t
    JOIN users u ON u.id = t.user_id
    LEFT JOIN predictions p ON p.ticket_id::text = t.id::text
    LEFT JOIN prediction_scores ps ON ps.prediction_id = p.id
    WHERE ${where}
      AND NOT COALESCE(t.is_promo_bonus, false)
      AND t.status IN ('paid','approved')
    GROUP BY t.id, u.name, u.email, t.total_amount_cents, t.paid_at, t.settled_at
    ORDER BY total_points DESC, exact_hits DESC, outcome_hits DESC, matches_picked DESC, t.paid_at ASC NULLS LAST
  `);
  return rows;
}

async function main() {
  const client = await pool.connect();
  try {
    const generalStats = (
      await client.query(`
      SELECT
        COUNT(*)::int AS total_tickets,
        COUNT(*) FILTER (WHERE status IN ('paid','approved'))::int AS paid_tickets,
        COALESCE(SUM(total_amount_cents) FILTER (WHERE status IN ('paid','approved')),0)::bigint AS revenue_cents,
        COALESCE(SUM(quantity) FILTER (WHERE status IN ('paid','approved')),0)::int AS total_quotas,
        MIN(paid_at) FILTER (WHERE status IN ('paid','approved')) AS first_paid,
        MAX(paid_at) FILTER (WHERE status IN ('paid','approved')) AS last_paid,
        COUNT(*) FILTER (WHERE settled_at IS NOT NULL)::int AS settled_count
      FROM tickets
      WHERE ticket_type = 'general' AND bolao_definition_id IS NULL AND NOT COALESCE(is_promo_bonus, false)
    `)
    ).rows[0];

    const skaleStats = (
      await client.query(`
      SELECT
        COUNT(*)::int AS total_tickets,
        COUNT(*) FILTER (WHERE status IN ('paid','approved'))::int AS paid_tickets,
        COALESCE(SUM(total_amount_cents) FILTER (WHERE status IN ('paid','approved')),0)::bigint AS revenue_cents,
        COALESCE(SUM(quantity) FILTER (WHERE status IN ('paid','approved')),0)::int AS total_quotas,
        MIN(paid_at) FILTER (WHERE status IN ('paid','approved')) AS first_paid,
        MAX(paid_at) FILTER (WHERE status IN ('paid','approved')) AS last_paid,
        COUNT(*) FILTER (WHERE settled_at IS NOT NULL)::int AS settled_count
      FROM tickets
      WHERE ticket_type = 'extra' AND extra_championship_id = 90007 AND bolao_definition_id IS NULL AND NOT COALESCE(is_promo_bonus, false)
    `)
    ).rows[0];

    const matches72 = (
      await client.query(`
      SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='finished')::int AS finished,
        COUNT(*) FILTER (WHERE status NOT IN ('finished','cancelled','postponed'))::int AS pending
      FROM matches_cache WHERE competition_id=72
    `)
    ).rows[0];

    const matchesSkale = (
      await client.query(`
      SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='finished')::int AS finished,
        COUNT(*) FILTER (WHERE status NOT IN ('finished','cancelled','postponed'))::int AS pending
      FROM matches_cache WHERE competition_id=90007
    `)
    ).rows[0];

    const generalClosures = (
      await client.query(`
      SELECT id, closure_key, bolao_type, competition_id, total_revenue_cents, pool_cents, processado, status, created_at
      FROM prize_closures WHERE bolao_type='general' ORDER BY created_at DESC LIMIT 5
    `)
    ).rows;

    const skaleClosures = (
      await client.query(`
      SELECT id, closure_key, bolao_type, competition_id, total_revenue_cents, pool_cents, processado, status, created_at, metadata
      FROM prize_closures WHERE bolao_type='extra' AND competition_id=90007 ORDER BY created_at DESC LIMIT 5
    `)
    ).rows;

    const generalAwards = (
      await client.query(`
      SELECT pa.rank_position, pa.amount_cents, pa.ticket_id::text, u.email, u.name, pc.processado, pc.created_at
      FROM prize_awards pa
      JOIN prize_closures pc ON pc.id = pa.closure_id
      LEFT JOIN tickets t ON t.id::text = pa.ticket_id::text
      LEFT JOIN users u ON u.id = t.user_id
      WHERE pc.bolao_type='general'
      ORDER BY pa.rank_position LIMIT 20
    `)
    ).rows;

    const skaleAwards = (
      await client.query(`
      SELECT pa.rank_position, pa.amount_cents, pa.ticket_id::text, u.email, u.name, pc.processado, pc.created_at
      FROM prize_awards pa
      JOIN prize_closures pc ON pc.id = pa.closure_id
      LEFT JOIN tickets t ON t.id::text = pa.ticket_id::text
      LEFT JOIN users u ON u.id = t.user_id
      WHERE pc.bolao_type='extra' AND pc.competition_id=90007
      ORDER BY pa.rank_position LIMIT 10
    `)
    ).rows;

    const generalRanking = await rankingQuery(client, "general");
    const skaleRanking = await rankingQuery(client, "skale");

    const genRev = Number(generalStats.revenue_cents);
    const skRev = Number(skaleStats.revenue_cents);
    const genPool = getGeneralBolaoFixedPoolCents();
    const genWinnerCap = getGeneralBolaoFixedWinnerCount();
    const skPool = calculateSkalePrizePoolCents(skRev);
    const genAwardsProj = calculatePrizeAwards(
      genPool,
      Math.min(generalRanking.length, genWinnerCap),
      "general",
    );
    const skAwardsProj = calculateSkalePrizeAwards(skRev);

    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          general: {
            stats: generalStats,
            fixedParticipants: getGeneralBolaoFixedParticipantCount(),
            fixedWinners: genWinnerCap,
            poolFixedBrl: brl(genPool),
            matchesCopa72: matches72,
            closures: generalClosures,
            awardsPaid: generalAwards,
            rankingCount: generalRanking.length,
            top15: generalRanking.slice(0, 15).map((r, i) => ({
              pos: i + 1,
              nome: r.nome,
              email: r.email,
              points: r.total_points,
              exact: r.exact_hits,
              matches: r.matches_picked,
              prizeProjected: brl(genAwardsProj[i]?.amountCents ?? 0),
            })),
            prizeTop10Projected: genAwardsProj
              .slice(0, 10)
              .map((a) => ({ rank: a.rank, prize: brl(a.amountCents) })),
            status: generalClosures.some((c) => c.processado)
              ? "PREMIADO"
              : "EM ANDAMENTO",
          },
          skale: {
            stats: skaleStats,
            revenueBrl: brl(skRev),
            pool100Bps: brl(skPool),
            poolPercent: "100%",
            prizeRule: "1º 60% · 2º 30% · 3º 10%",
            matches90007: matchesSkale,
            closures: skaleClosures,
            awardsPaid: skaleAwards,
            rankingCount: skaleRanking.length,
            top10: skaleRanking.slice(0, 10).map((r, i) => ({
              pos: i + 1,
              nome: r.nome,
              email: r.email,
              points: r.total_points,
              exact: r.exact_hits,
              matches: r.matches_picked,
              prizeProjected: brl(skAwardsProj[i]?.amountCents ?? 0),
            })),
            prizeTop3Projected: skAwardsProj.map((a) => ({
              rank: a.rank,
              prize: brl(a.amountCents),
            })),
            status: skaleClosures.some((c) => c.processado)
              ? "PREMIADO"
              : "EM ANDAMENTO",
          },
        },
        null,
        2,
      ),
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
