/**
 * Premiação fixa do Bolão Série B — top 3 creditados em `users.balance_cents`.
 *
 * Valores: 1º R$ 1.000 · 2º R$ 500 · 3º R$ 300
 */

import type { PoolClient } from "pg";
import { getSerieBExtraChampionshipId } from "@/lib/football/amistosos-friendlies";
import { fetchMatchesMapDirectFromDb } from "@/lib/football-api";
import { getMatchFromMap } from "@/lib/match-map-types";
import { getPool } from "@/lib/db";
import { calcPredictionPoints } from "@/lib/predictions/calc-points";

export const SERIE_B_PRIZE_AMOUNTS_BRL = {
  1: "R$ 1.000",
  2: "R$ 500",
  3: "R$ 300",
} as const;

export const SERIE_B_PRIZE_CENTS = {
  1: 100_000,
  2: 50_000,
  3: 30_000,
} as const;

export type SerieBPrizeWinner = {
  position: 1 | 2 | 3;
  ticketId: string;
  userId: string;
  displayName: string;
  totalPoints: number;
  exactCount: number;
};

export type SerieBPrizeCreditResult = {
  closureKey: string;
  rodada: number;
  competitionId: number;
  winners: SerieBPrizeWinner[];
  credited: Array<{
    position: number;
    userId: string;
    ticketId: string;
    amountCents: number;
    alreadyCredited: boolean;
  }>;
  dryRun: boolean;
};

function serieBClosureKey(competitionId: number, rodada: number): string {
  return `${competitionId}:serie_b:round:${rodada}`;
}

async function ensurePrizeSchema(client: PoolClient): Promise<void> {
  await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS prize_closures (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      closure_key text NOT NULL UNIQUE,
      competition_id integer NOT NULL,
      bolao_type text NOT NULL CHECK (bolao_type IN ('general', 'daily', 'extra')),
      date_br text,
      status text NOT NULL DEFAULT 'processed',
      processado boolean NOT NULL DEFAULT false,
      total_revenue_cents integer NOT NULL DEFAULT 0,
      pool_cents integer NOT NULL DEFAULT 0,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      processed_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.query(
    `ALTER TABLE prize_closures ADD COLUMN IF NOT EXISTS processado boolean NOT NULL DEFAULT false`,
  );
  await client.query(`
    CREATE TABLE IF NOT EXISTS prize_awards (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      closure_id uuid NOT NULL REFERENCES prize_closures (id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      ticket_id text NOT NULL,
      rank_position integer NOT NULL,
      amount_cents integer NOT NULL,
      total_points integer NOT NULL DEFAULT 0,
      exact_count integer NOT NULL DEFAULT 0,
      outcome_count integer NOT NULL DEFAULT 0,
      goals_count integer NOT NULL DEFAULT 0,
      best_streak integer NOT NULL DEFAULT 0,
      transaction_id uuid,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (closure_id, ticket_id)
    )
  `);
}

export async function resolveSerieBTopWinners(
  rodada: number,
  limit = 3,
): Promise<SerieBPrizeWinner[]> {
  const competitionId = getSerieBExtraChampionshipId();
  const pool = getPool();
  const matches = await fetchMatchesMapDirectFromDb();

  const roundMatches = await pool.query<{ match_id: string }>(
    `SELECT match_id::text FROM matches_cache WHERE competition_id = $1 AND rodada = $2`,
    [competitionId, rodada],
  );
  const roundMatchIds = new Set(roundMatches.rows.map((r) => Number(r.match_id)));

  const { rows: preds } = await pool.query<{
    ticket_id: string;
    user_id: string;
    match_id: string;
    score_casa: number;
    score_visitante: number;
    submitted_at: Date;
  }>(
    `SELECT p.ticket_id, t.user_id::text AS user_id, p.match_id::text,
            p.score_casa, p.score_visitante, p.submitted_at
     FROM predictions p
     JOIN tickets t ON t.id::text = p.ticket_id
     WHERE t.extra_championship_id = $1
       AND t.status IN ('paid', 'approved')
       AND t.round_number = $2`,
    [competitionId, rodada],
  );

  type Agg = {
    ticketId: string;
    userId: string;
    totalPoints: number;
    exactCount: number;
    outcomeCount: number;
    goalsCount: number;
    bestStreak: number;
    firstSubmitAt: number;
    hitSequence: Array<{ order: number; hit: boolean }>;
  };

  const byTicket = new Map<string, Agg>();
  for (const p of preds) {
    const mid = Number(p.match_id);
    if (!roundMatchIds.has(mid)) continue;
    const m = getMatchFromMap(matches, competitionId, mid);
    if (!m || m.resultCasa == null || m.resultVisitante == null) continue;

    const cur =
      byTicket.get(p.ticket_id) ??
      ({
        ticketId: p.ticket_id,
        userId: p.user_id,
        totalPoints: 0,
        exactCount: 0,
        outcomeCount: 0,
        goalsCount: 0,
        bestStreak: 0,
        firstSubmitAt: new Date(p.submitted_at).getTime(),
        hitSequence: [],
      } satisfies Agg);

    const calc = calcPredictionPoints(
      p.score_casa,
      p.score_visitante,
      m.resultCasa,
      m.resultVisitante,
    );
    cur.totalPoints += calc.points;
    cur.exactCount += calc.exact ? 1 : 0;
    cur.outcomeCount += calc.outcomeHit ? 1 : 0;
    cur.goalsCount += calc.goalsHitCount;
    cur.hitSequence.push({
      order: m.kickoffAt ? new Date(m.kickoffAt).getTime() : mid,
      hit: calc.points > 0,
    });
    cur.firstSubmitAt = Math.min(cur.firstSubmitAt, new Date(p.submitted_at).getTime());
    byTicket.set(p.ticket_id, cur);
  }

  const ranked = [...byTicket.values()]
    .map((row) => {
      let current = 0;
      for (const item of row.hitSequence.sort((a, b) => a.order - b.order)) {
        if (item.hit) {
          current += 1;
          row.bestStreak = Math.max(row.bestStreak, current);
        } else {
          current = 0;
        }
      }
      return row;
    })
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
      if (b.outcomeCount !== a.outcomeCount) return b.outcomeCount - a.outcomeCount;
      if (b.goalsCount !== a.goalsCount) return b.goalsCount - a.goalsCount;
      if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
      return a.firstSubmitAt - b.firstSubmitAt;
    });

  const top = ranked.slice(0, limit);
  if (top.length === 0) return [];

  const userIds = [...new Set(top.map((t) => t.userId))];
  const { rows: users } = await pool.query<{ id: string; name: string | null; email: string }>(
    `SELECT id::text, name, email FROM users WHERE id::text = ANY($1::text[])`,
    [userIds],
  );
  const userById = new Map(users.map((u) => [u.id, u]));

  const winners: SerieBPrizeWinner[] = [];
  for (let i = 0; i < top.length; i++) {
    const row = top[i]!;
    const pos = (i + 1) as 1 | 2 | 3;
    if (pos > 3) break;
    const u = userById.get(row.userId);
    const displayName =
      (u?.name?.trim() || u?.email?.split("@")[0] || "Jogador").trim() || "Jogador";
    winners.push({
      position: pos,
      ticketId: row.ticketId,
      userId: row.userId,
      displayName,
      totalPoints: row.totalPoints,
      exactCount: row.exactCount,
    });
  }
  return winners;
}

async function creditWinnerBalance(
  client: PoolClient,
  input: {
    closureId: string;
    competitionId: number;
    rodada: number;
    winner: SerieBPrizeWinner;
    amountCents: number;
  },
): Promise<boolean> {
  const description = `Premiacao Bolao Serie B (${input.rodada}a rodada) - Ticket ${input.winner.ticketId} - ${input.winner.position} lugar`;
  const metadata = {
    description,
    competitionId: input.competitionId,
    bolaoType: "extra",
    prizeModel: "serie_b_fixed_top3",
    rodada: input.rodada,
    rank: input.winner.position,
    ticketId: input.winner.ticketId,
    points: input.winner.totalPoints,
  };

  const awardInsert = await client.query<{ id: string }>(
    `INSERT INTO prize_awards (
       closure_id, user_id, ticket_id, rank_position, amount_cents,
       total_points, exact_count, metadata
     ) VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (closure_id, ticket_id) DO NOTHING
     RETURNING id`,
    [
      input.closureId,
      input.winner.userId,
      input.winner.ticketId,
      input.winner.position,
      input.amountCents,
      input.winner.totalPoints,
      input.winner.exactCount,
      JSON.stringify(metadata),
    ],
  );
  const awardId = awardInsert.rows[0]?.id;
  if (!awardId) return false;

  const externalRef = `internal_prize:${input.closureId}:rank:${input.winner.position}`;
  const existingTx = await client.query<{ id: string }>(
    `SELECT id FROM transactions
     WHERE provider = 'internal_prize' AND external_ref = $1 AND user_id = $2::uuid
     LIMIT 1`,
    [externalRef, input.winner.userId],
  );
  if (existingTx.rows[0]?.id) {
    await client.query(
      `UPDATE prize_awards SET transaction_id = COALESCE(transaction_id, $2::uuid) WHERE id = $1`,
      [awardId, existingTx.rows[0].id],
    );
    return false;
  }

  const tx = await client.query<{ id: string }>(
    `INSERT INTO transactions (
       user_id, ticket_id, ticket_type, provider, status, amount_cents, payment_method, external_ref, raw_request, raw_response
     ) VALUES ($1::uuid, $2::uuid, 'extra', 'internal_prize', 'paid', $3, 'wallet', $4, $5::jsonb, $5::jsonb)
     RETURNING id`,
    [input.winner.userId, input.winner.ticketId, input.amountCents, externalRef, JSON.stringify(metadata)],
  );

  await client.query(
    `UPDATE prize_awards SET transaction_id = $2 WHERE id = $1`,
    [awardId, tx.rows[0]!.id],
  );
  await client.query(
    `UPDATE users SET balance_cents = COALESCE(balance_cents, 0) + $2 WHERE id = $1::uuid`,
    [input.winner.userId, input.amountCents],
  );
  return true;
}

export async function creditSerieBTop3Prizes(input: {
  rodada: number;
  dryRun?: boolean;
}): Promise<SerieBPrizeCreditResult> {
  const rodada = Math.max(1, Math.trunc(input.rodada));
  const competitionId = getSerieBExtraChampionshipId();
  const closureKey = serieBClosureKey(competitionId, rodada);
  const winners = await resolveSerieBTopWinners(rodada, 3);
  const dryRun = input.dryRun === true;

  const empty: SerieBPrizeCreditResult = {
    closureKey,
    rodada,
    competitionId,
    winners,
    credited: [],
    dryRun,
  };
  if (winners.length === 0) return empty;

  if (dryRun) {
    return {
      ...empty,
      credited: winners.map((w) => ({
        position: w.position,
        userId: w.userId,
        ticketId: w.ticketId,
        amountCents: SERIE_B_PRIZE_CENTS[w.position],
        alreadyCredited: false,
      })),
    };
  }

  const pool = getPool();
  const client = await pool.connect();
  const credited: SerieBPrizeCreditResult["credited"] = [];

  try {
    await ensurePrizeSchema(client);
    await client.query("BEGIN");

    const poolCents = SERIE_B_PRIZE_CENTS[1] + SERIE_B_PRIZE_CENTS[2] + SERIE_B_PRIZE_CENTS[3];
    const closureInsert = await client.query<{ id: string }>(
      `INSERT INTO prize_closures (
         closure_key, competition_id, bolao_type, date_br, status, processado, total_revenue_cents, pool_cents, metadata
       ) VALUES ($1, $2, 'extra', NULL, 'processed', false, 0, $3, $4::jsonb)
       ON CONFLICT (closure_key) DO NOTHING
       RETURNING id`,
      [
        closureKey,
        competitionId,
        poolCents,
        JSON.stringify({
          prizeModel: "serie_b_fixed_top3",
          rodada,
          amountsCents: SERIE_B_PRIZE_CENTS,
        }),
      ],
    );

    let closureId = closureInsert.rows[0]?.id;
    if (!closureId) {
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM prize_closures WHERE closure_key = $1 LIMIT 1`,
        [closureKey],
      );
      closureId = existing.rows[0]?.id;
    }
    if (!closureId) {
      throw new Error("Nao foi possivel criar ou localizar prize_closure da Serie B.");
    }

    for (const winner of winners) {
      const amountCents = SERIE_B_PRIZE_CENTS[winner.position];
      const didCredit = await creditWinnerBalance(client, {
        closureId,
        competitionId,
        rodada,
        winner,
        amountCents,
      });
      credited.push({
        position: winner.position,
        userId: winner.userId,
        ticketId: winner.ticketId,
        amountCents,
        alreadyCredited: !didCredit,
      });
    }

    await client.query(
      `UPDATE prize_closures SET processado = true, updated_at = now() WHERE id = $1`,
      [closureId],
    );

    const ticketIds = winners.map((w) => w.ticketId);
    await client.query(
      `UPDATE tickets
         SET settled_at = COALESCE(settled_at, now()),
             settled_closure_id = COALESCE(settled_closure_id, $2::uuid),
             updated_at = now()
       WHERE id::text = ANY($1::text[])
         AND settled_at IS NULL`,
      [ticketIds, closureId],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { closureKey, rodada, competitionId, winners, credited, dryRun };
}
