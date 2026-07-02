import type { BolaoDefinition } from "@/lib/boloes/definitions/types";
import {
  calculateDefinitionPrizeAwards,
  calculateDefinitionPrizePoolCents,
} from "@/lib/boloes/definitions/prizes";
import { buildDefinitionRanking } from "@/lib/boloes/definitions/ranking";
import {
  isDefinitionReadyForPrizeRelease,
  isDefinitionReadyForSettlement,
} from "@/lib/boloes/definitions/settlement";
import { scopeMatchesForBolaoDefinition } from "@/lib/boloes/definitions/scope";
import { appendBolaoDefinitionAuditLog } from "@/lib/boloes/definitions/audit-log";
import { updateBolaoLifecycleStatus } from "@/lib/boloes/definitions/repository";
import { type MatchMap } from "@/lib/football-api";
import { getPool } from "@/lib/db";
import type { PoolClient } from "pg";

type RankingRow = {
  ticketId: string;
  userId: string;
  totalPoints: number;
  exactCount: number;
  outcomeCount: number;
  goalsCount: number;
  bestStreak: number;
  firstSubmitAt: number;
};

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

async function creditAward(
  client: PoolClient,
  input: {
    closureId: string;
    def: BolaoDefinition;
    rank: number;
    amountCents: number;
    ranking: RankingRow;
  },
): Promise<void> {
  const description = `Premiação ${input.def.displayName} — ${input.rank}º lugar`;
  const metadata = {
    description,
    bolaoDefinitionId: input.def.id,
    rank: input.rank,
    ticketId: input.ranking.ticketId,
    points: input.ranking.totalPoints,
  };

  const awardInsert = await client.query<{ id: string }>(
    `INSERT INTO prize_awards (
       closure_id, user_id, ticket_id, rank_position, amount_cents,
       total_points, exact_count, outcome_count, goals_count, best_streak, metadata
     ) VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
     ON CONFLICT (closure_id, ticket_id) DO NOTHING
     RETURNING id`,
    [
      input.closureId,
      input.ranking.userId,
      input.ranking.ticketId,
      input.rank,
      input.amountCents,
      input.ranking.totalPoints,
      input.ranking.exactCount,
      input.ranking.outcomeCount,
      input.ranking.goalsCount,
      input.ranking.bestStreak,
      JSON.stringify(metadata),
    ],
  );
  const awardId = awardInsert.rows[0]?.id;
  if (!awardId || input.amountCents <= 0) return;

  const externalRef = `definition_prize:${input.def.id}:rank:${input.rank}`;
  const existingTx = await client.query<{ id: string }>(
    `SELECT id FROM transactions
     WHERE provider = 'internal_prize' AND external_ref = $1 AND user_id = $2::uuid
     LIMIT 1`,
    [externalRef, input.ranking.userId],
  );
  const priorTxId = existingTx.rows[0]?.id;
  if (priorTxId) {
    await client.query(
      `UPDATE prize_awards SET transaction_id = COALESCE(transaction_id, $2::uuid) WHERE id = $1`,
      [awardId, priorTxId],
    );
    return;
  }

  const ticketType = input.def.ticketType;
  const tx = await client.query<{ id: string }>(
    `INSERT INTO transactions (
       user_id, ticket_id, ticket_type, provider, status, amount_cents, payment_method, external_ref, raw_request, raw_response
     ) VALUES ($1::uuid, $2::uuid, $3::ticket_type_enum, 'internal_prize', 'paid', $4, 'wallet', $5, $6::jsonb, $6::jsonb)
     RETURNING id`,
    [
      input.ranking.userId,
      input.ranking.ticketId,
      ticketType,
      input.amountCents,
      externalRef,
      JSON.stringify(metadata),
    ],
  );

  await client.query(`UPDATE prize_awards SET transaction_id = $2 WHERE id = $1`, [
    awardId,
    tx.rows[0]!.id,
  ]);
  await client.query(
    `UPDATE users SET balance_cents = COALESCE(balance_cents, 0) + $2 WHERE id = $1::uuid`,
    [input.ranking.userId, input.amountCents],
  );
}

export async function processDefinitionPrizeClosure(
  def: BolaoDefinition,
  matches: MatchMap,
): Promise<boolean> {
  const scoped = scopeMatchesForBolaoDefinition(def, matches);
  const nowMs = Date.now();
  if (!isDefinitionReadyForSettlement(def, scoped, nowMs)) return false;
  if (!isDefinitionReadyForPrizeRelease(def, nowMs)) return false;

  const pool = getPool();
  const closureKey = `definition:${def.id}`;
  const existing = await pool.query(
    `SELECT id FROM prize_closures WHERE closure_key = $1 AND processado = true LIMIT 1`,
    [closureKey],
  );
  if ((existing.rowCount ?? 0) > 0) return false;

  const scopedIds = scoped.map((m) => m.id);
  const { rows: tickets } = await pool.query<{
    id: string;
    user_id: string;
    total_amount_cents: number;
    paid_at: Date | null;
    created_at: Date;
  }>(
    `SELECT id, user_id, total_amount_cents, paid_at, created_at
       FROM tickets
      WHERE bolao_definition_id = $1 AND status = 'paid'`,
    [def.id],
  );

  const client = await pool.connect();
  try {
    await ensurePrizeSchema(client);
    await client.query("BEGIN");

    const revenueCents = tickets.reduce((s, t) => s + Number(t.total_amount_cents || 0), 0);
    const poolCents = calculateDefinitionPrizePoolCents(def, revenueCents);

    const { rows: closureRows } = await client.query<{ id: string }>(
      `INSERT INTO prize_closures (
         closure_key, competition_id, bolao_type, date_br, status, processado,
         total_revenue_cents, pool_cents, metadata
       ) VALUES ($1, $2, $3, NULL, 'processed', false, $4, $5, $6::jsonb)
       ON CONFLICT (closure_key) DO NOTHING
       RETURNING id`,
      [
        closureKey,
        def.competitionId,
        def.ticketType,
        revenueCents,
        poolCents,
        JSON.stringify({
          bolaoDefinitionId: def.id,
          displayName: def.displayName,
          scopedMatchIds: scopedIds,
        }),
      ],
    );
    const closureId = closureRows[0]?.id;
    if (!closureId) {
      await client.query("ROLLBACK");
      return false;
    }

    if (tickets.length > 0) {
      const rankingRows = await buildDefinitionRanking(def, matches);
      const ranking: RankingRow[] = rankingRows.map((r) => ({
        ticketId: r.ticketId,
        userId: r.userId,
        totalPoints: r.totalPoints,
        exactCount: r.exactCount,
        outcomeCount: r.outcomeCount,
        goalsCount: r.goalsCount,
        bestStreak: 0,
        firstSubmitAt: r.firstSubmitAt,
      }));

      const awards = calculateDefinitionPrizeAwards(poolCents, ranking.length, def.prizeTiers);
      for (const award of awards) {
        const winner = ranking[award.rank - 1];
        if (!winner || award.amountCents <= 0) continue;
        await creditAward(client, {
          closureId,
          def,
          rank: award.rank,
          amountCents: award.amountCents,
          ranking: winner,
        });
      }

      if (tickets.length > 0) {
        await client.query(
          `UPDATE tickets
              SET settled_at = COALESCE(settled_at, now()),
                  settled_closure_id = COALESCE(settled_closure_id, $2::uuid),
                  updated_at = now()
            WHERE bolao_definition_id = $1
              AND status IN ('paid', 'approved')`,
          [def.id, closureId],
        );
      }
    }

    await client.query(
      `UPDATE prize_closures SET processado = true, updated_at = now() WHERE id = $1`,
      [closureId],
    );
    await client.query("COMMIT");

    await updateBolaoLifecycleStatus(def.id, "premiacao_liberada");
    await appendBolaoDefinitionAuditLog({
      bolaoDefinitionId: def.id,
      action: "premiacao_liberada",
      payload: { closureId, poolCents },
    });
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[definition-prize-processor]", def.id, error);
    return false;
  } finally {
    client.release();
  }
}
