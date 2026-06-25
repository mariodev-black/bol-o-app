/**
 * Premiação manual do Bolão Diário por edição (#1–#12) — Top 10, pool = 100% da arrecadação.
 */

import type { PoolClient } from "pg";
import {
  dailyEditionCardTitle,
  dailyEditionClosureKey,
  getDailyEdition,
} from "@/lib/boloes/daily-editions";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { getPool } from "@/lib/db";
import { dispatchAdminBroadcast } from "@/lib/notifications/admin-dispatch";
import type { AdminBroadcastChannel } from "@/lib/notifications/admin-broadcast-shared";
import { calcPredictionPoints } from "@/lib/predictions/calc-points";
import {
  calculateDailyPrizePoolCents,
  calculatePrizeAwards,
  DAILY_PRIZE_SHARE_PERCENT,
} from "@/lib/prizes/distribution";

export type DailyEditionPrizeWinner = {
  position: number;
  ticketId: string;
  userId: string;
  displayName: string;
  totalPoints: number;
  exactCount: number;
  amountCents: number;
  amountLabel: string;
};

export type DailyEditionPrizeCreditResult = {
  closureKey: string;
  editionNumber: number;
  competitionId: number;
  ticketsCount: number;
  totalRevenueCents: number;
  poolCents: number;
  winners: DailyEditionPrizeWinner[];
  credited: Array<{
    position: number;
    userId: string;
    ticketId: string;
    amountCents: number;
    alreadyCredited: boolean;
  }>;
  dryRun: boolean;
};

export type DailyEditionPrizeNotifyResult = {
  batchId: string;
  winners: DailyEditionPrizeWinner[];
  app: { created: number };
  push: { sent: number; failed: number };
};

function formatBrlCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function rankEmoji(position: number): string {
  if (position === 1) return "🥇";
  if (position === 2) return "🥈";
  if (position === 3) return "🥉";
  return `${position}º`;
}

export function buildDailyEditionWinnerNotificationCopy(
  winner: DailyEditionPrizeWinner,
  editionNumber: number,
): { title: string; preview: string; body: string } {
  const editionLabel = dailyEditionCardTitle(editionNumber);
  const title = `${rankEmoji(winner.position)} ${winner.position}º lugar no ${editionLabel}!`;
  const preview = `Você ganhou ${winner.amountLabel} com ${winner.totalPoints} pontos. O valor já está no seu saldo.`;
  const body = [
    `O ${editionLabel} foi finalizado e você ficou em ${winner.position}º lugar com ${winner.totalPoints} pontos!`,
    "",
    `Sua premiação: ${winner.amountLabel} (${DAILY_PRIZE_SHARE_PERCENT[winner.position - 1] ?? "—"}% do pool).`,
    "",
    "O valor já foi creditado no seu saldo da conta. Acesse Saques ou continue jogando nos próximos bolões diários.",
  ].join("\n");
  return { title, preview, body };
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

type RankingRow = {
  ticketId: string;
  userId: string;
  displayName: string;
  totalPoints: number;
  exactCount: number;
  outcomeCount: number;
  goalsCount: number;
  bestStreak: number;
  firstSubmitAt: number;
};

export async function resolveDailyEditionTopWinners(
  editionNumber: number,
  limit = 10,
): Promise<{ winners: RankingRow[]; totalRevenueCents: number; ticketsCount: number }> {
  const edition = getDailyEdition(editionNumber);
  if (!edition) {
    throw new Error(`Edicao diaria invalida: ${editionNumber}`);
  }

  const pool = getPool();
  const compId = getFootballMainCompetitionId();

  const [ticketsRes, matchesRes, usersRes] = await Promise.all([
    pool.query<{
      id: string;
      user_id: string;
      total_amount_cents: number;
      paid_at: Date | null;
      created_at: Date;
    }>(
      `SELECT id::text, user_id::text, total_amount_cents, paid_at, created_at
       FROM tickets
       WHERE ticket_type = 'daily'
         AND round_number = $1
         AND NOT COALESCE(is_promo_bonus, false)
         AND status IN ('paid', 'approved')
       ORDER BY paid_at ASC NULLS LAST, created_at ASC`,
      [editionNumber],
    ),
    pool.query<{
      match_id: number;
      kickoff_at: string | null;
      result_casa: number | null;
      result_visitante: number | null;
    }>(
      `SELECT match_id, kickoff_at::text, result_casa, result_visitante
       FROM matches_cache
       WHERE competition_id = $1
         AND date_br = ANY($2::text[])`,
      [compId, edition.datesBR],
    ),
    pool.query<{ id: string; name: string | null; email: string }>(
      `SELECT u.id::text, u.name, u.email
       FROM users u
       WHERE u.id IN (
         SELECT DISTINCT user_id FROM tickets
         WHERE ticket_type = 'daily' AND round_number = $1 AND status IN ('paid', 'approved')
       )`,
      [editionNumber],
    ),
  ]);

  const tickets = ticketsRes.rows;
  if (tickets.length === 0) {
    return { winners: [], totalRevenueCents: 0, ticketsCount: 0 };
  }

  const ticketIds = tickets.map((t) => t.id);
  const { rows: predictions } = await pool.query<{
    ticket_id: string;
    match_id: number;
    score_casa: number;
    score_visitante: number;
    submitted_at: Date;
  }>(
    `SELECT ticket_id::text, match_id, score_casa, score_visitante, submitted_at
     FROM predictions
     WHERE ticket_id::text = ANY($1::text[])`,
    [ticketIds],
  );

  const matchMap = new Map(matchesRes.rows.map((m) => [Number(m.match_id), m]));
  const userById = new Map(usersRes.rows.map((u) => [u.id, u]));
  const predictionsByTicket = new Map<string, typeof predictions>();
  for (const p of predictions) {
    const arr = predictionsByTicket.get(p.ticket_id) ?? [];
    arr.push(p);
    predictionsByTicket.set(p.ticket_id, arr);
  }

  const ranking: RankingRow[] = tickets.map((ticket) => {
    const preds = (predictionsByTicket.get(ticket.id) ?? []).sort((a, b) => {
      const ma = matchMap.get(Number(a.match_id));
      const mb = matchMap.get(Number(b.match_id));
      const da = ma?.kickoff_at ? new Date(ma.kickoff_at).getTime() : Number(a.match_id);
      const db = mb?.kickoff_at ? new Date(mb.kickoff_at).getTime() : Number(b.match_id);
      return da - db || Number(a.match_id) - Number(b.match_id);
    });

    let totalPoints = 0;
    let exactCount = 0;
    let outcomeCount = 0;
    let goalsCount = 0;
    let currentStreak = 0;
    let bestStreak = 0;
    let firstSubmitAt = ticket.paid_at?.getTime() ?? ticket.created_at.getTime();

    for (const prediction of preds) {
      const match = matchMap.get(Number(prediction.match_id));
      if (!match || match.result_casa == null || match.result_visitante == null) continue;
      const calc = calcPredictionPoints(
        prediction.score_casa,
        prediction.score_visitante,
        match.result_casa,
        match.result_visitante,
      );
      totalPoints += calc.points;
      exactCount += calc.exact ? 1 : 0;
      outcomeCount += calc.outcomeHit ? 1 : 0;
      goalsCount += calc.goalsHitCount;
      if (calc.points > 0) {
        currentStreak += 1;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
      firstSubmitAt = Math.min(firstSubmitAt, prediction.submitted_at.getTime());
    }

    const user = userById.get(ticket.user_id);
    const displayName =
      (user?.name ?? "").trim() ||
      (user?.email ?? "").split("@")[0] ||
      "Jogador";

    return {
      ticketId: ticket.id,
      userId: ticket.user_id,
      displayName,
      totalPoints,
      exactCount,
      outcomeCount,
      goalsCount,
      bestStreak,
      firstSubmitAt,
    };
  });

  ranking.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
    if (b.outcomeCount !== a.outcomeCount) return b.outcomeCount - a.outcomeCount;
    if (b.goalsCount !== a.goalsCount) return b.goalsCount - a.goalsCount;
    if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
    return a.firstSubmitAt - b.firstSubmitAt;
  });

  const totalRevenueCents = tickets.reduce(
    (sum, t) => sum + Number(t.total_amount_cents || 0),
    0,
  );

  return {
    winners: ranking.slice(0, limit),
    totalRevenueCents,
    ticketsCount: tickets.length,
  };
}

async function creditWinnerBalance(
  client: PoolClient,
  input: {
    closureId: string;
    competitionId: number;
    editionNumber: number;
    dateBR: string | null;
    winner: RankingRow;
    position: number;
    amountCents: number;
  },
): Promise<boolean> {
  const description = `Premiacao ${dailyEditionCardTitle(input.editionNumber)} - Ticket ${input.winner.ticketId} - ${input.position} lugar`;
  const metadata = {
    description,
    competitionId: input.competitionId,
    bolaoType: "daily",
    dailyEditionNumber: input.editionNumber,
    dateBR: input.dateBR,
    rank: input.position,
    ticketId: input.winner.ticketId,
    points: input.winner.totalPoints,
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
      input.winner.userId,
      input.winner.ticketId,
      input.position,
      input.amountCents,
      input.winner.totalPoints,
      input.winner.exactCount,
      input.winner.outcomeCount,
      input.winner.goalsCount,
      input.winner.bestStreak,
      JSON.stringify(metadata),
    ],
  );
  const awardId = awardInsert.rows[0]?.id;
  if (!awardId) return false;

  const externalRef = `internal_prize:${input.closureId}:rank:${input.position}`;
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
     ) VALUES ($1::uuid, $2::uuid, 'daily', 'internal_prize', 'paid', $3, 'wallet', $4, $5::jsonb, $5::jsonb)
     RETURNING id`,
    [input.winner.userId, input.winner.ticketId, input.amountCents, externalRef, JSON.stringify(metadata)],
  );

  await client.query(`UPDATE prize_awards SET transaction_id = $2 WHERE id = $1`, [
    awardId,
    tx.rows[0]!.id,
  ]);
  await client.query(
    `UPDATE users SET balance_cents = COALESCE(balance_cents, 0) + $2 WHERE id = $1::uuid`,
    [input.winner.userId, input.amountCents],
  );
  return true;
}

export async function creditDailyEditionTop10Prizes(input: {
  editionNumber: number;
  dryRun?: boolean;
}): Promise<DailyEditionPrizeCreditResult> {
  const editionNumber = Math.max(1, Math.trunc(input.editionNumber));
  const edition = getDailyEdition(editionNumber);
  if (!edition) throw new Error(`Edicao diaria invalida: ${editionNumber}`);

  const competitionId = getFootballMainCompetitionId();
  const closureKey = dailyEditionClosureKey(competitionId, editionNumber);
  const dateBR = edition.datesBR[edition.datesBR.length - 1] ?? null;
  const dryRun = input.dryRun === true;

  const { winners: ranking, totalRevenueCents, ticketsCount } =
    await resolveDailyEditionTopWinners(editionNumber, 10);
  const poolCents = calculateDailyPrizePoolCents(totalRevenueCents);
  const awardAmounts = calculatePrizeAwards(poolCents, ranking.length, "daily");

  const winners: DailyEditionPrizeWinner[] = awardAmounts.map((award) => {
    const row = ranking[award.rank - 1]!;
    return {
      position: award.rank,
      ticketId: row.ticketId,
      userId: row.userId,
      displayName: row.displayName,
      totalPoints: row.totalPoints,
      exactCount: row.exactCount,
      amountCents: award.amountCents,
      amountLabel: formatBrlCents(award.amountCents),
    };
  });

  const empty: DailyEditionPrizeCreditResult = {
    closureKey,
    editionNumber,
    competitionId,
    ticketsCount,
    totalRevenueCents,
    poolCents,
    winners,
    credited: [],
    dryRun,
  };

  if (winners.length === 0 || poolCents <= 0) return empty;

  if (dryRun) {
    return {
      ...empty,
      credited: winners.map((w) => ({
        position: w.position,
        userId: w.userId,
        ticketId: w.ticketId,
        amountCents: w.amountCents,
        alreadyCredited: false,
      })),
    };
  }

  const pool = getPool();
  const client = await pool.connect();
  const credited: DailyEditionPrizeCreditResult["credited"] = [];

  try {
    await ensurePrizeSchema(client);
    await client.query("BEGIN");

    const closureInsert = await client.query<{ id: string }>(
      `INSERT INTO prize_closures (
         closure_key, competition_id, bolao_type, date_br, status, processado, total_revenue_cents, pool_cents, metadata
       ) VALUES ($1, $2, 'daily', $3, 'processed', false, $4, $5, $6::jsonb)
       ON CONFLICT (closure_key) DO NOTHING
       RETURNING id`,
      [
        closureKey,
        competitionId,
        dateBR,
        totalRevenueCents,
        poolCents,
        JSON.stringify({
          prizeModel: "daily_edition_top10_percent",
          dailyEditionNumber: editionNumber,
          ticketCount: ticketsCount,
          datesBR: edition.datesBR,
          sharesPercent: [...DAILY_PRIZE_SHARE_PERCENT],
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
      throw new Error("Nao foi possivel criar ou localizar prize_closure do bolao diario.");
    }

    for (const winner of winners) {
      const row = ranking[winner.position - 1]!;
      const didCredit = await creditWinnerBalance(client, {
        closureId,
        competitionId,
        editionNumber,
        dateBR,
        winner: row,
        position: winner.position,
        amountCents: winner.amountCents,
      });
      credited.push({
        position: winner.position,
        userId: winner.userId,
        ticketId: winner.ticketId,
        amountCents: winner.amountCents,
        alreadyCredited: !didCredit,
      });
    }

    await client.query(
      `UPDATE prize_closures SET processado = true, updated_at = now() WHERE id = $1`,
      [closureId],
    );

    const ticketIds = ranking.map((w) => w.ticketId);
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

  return {
    closureKey,
    editionNumber,
    competitionId,
    ticketsCount,
    totalRevenueCents,
    poolCents,
    winners,
    credited,
    dryRun,
  };
}

export async function dispatchDailyEditionWinnerNotifications(input: {
  editionNumber: number;
  winners: DailyEditionPrizeWinner[];
  channels?: AdminBroadcastChannel[];
  dryRun?: boolean;
}): Promise<DailyEditionPrizeNotifyResult> {
  const batchId = crypto.randomUUID();
  const channels: AdminBroadcastChannel[] =
    input.channels && input.channels.length > 0
      ? [...new Set(input.channels)]
      : (["app", "push"] as AdminBroadcastChannel[]);
  const dryRun = input.dryRun === true;

  const empty: DailyEditionPrizeNotifyResult = {
    batchId,
    winners: input.winners,
    app: { created: 0 },
    push: { sent: 0, failed: 0 },
  };

  if (input.winners.length === 0 || channels.length === 0) return empty;
  if (dryRun) return empty;

  let appCreated = 0;
  let pushSent = 0;
  let pushFailed = 0;

  for (const winner of input.winners) {
    const copy = buildDailyEditionWinnerNotificationCopy(winner, input.editionNumber);
    const notify = await dispatchAdminBroadcast({
      batchId: crypto.randomUUID(),
      userIds: [winner.userId],
      channels,
      title: copy.title,
      preview: copy.preview,
      body: copy.body,
      pushTitle: copy.title,
      pushPreview: copy.preview,
      pushUrl: "/boloes",
      emailButton: null,
      emailLayout: "default",
      syncEmail: true,
    });
    appCreated += notify.app?.created ?? 0;
    pushSent += notify.push?.sent ?? 0;
    pushFailed += notify.push?.failed ?? 0;
  }

  return {
    batchId,
    winners: input.winners,
    app: { created: appCreated },
    push: { sent: pushSent, failed: pushFailed },
  };
}

export async function creditAndNotifyDailyEditionPrizes(input: {
  editionNumber: number;
  dryRun?: boolean;
  notify?: boolean;
  channels?: AdminBroadcastChannel[];
}): Promise<{
  credit: DailyEditionPrizeCreditResult;
  notify: DailyEditionPrizeNotifyResult | null;
}> {
  const credit = await creditDailyEditionTop10Prizes({
    editionNumber: input.editionNumber,
    dryRun: input.dryRun,
  });

  if (input.dryRun || input.notify === false || credit.winners.length === 0) {
    return { credit, notify: null };
  }

  const notify = await dispatchDailyEditionWinnerNotifications({
    editionNumber: input.editionNumber,
    winners: credit.winners,
    channels: input.channels,
  });

  return { credit, notify };
}
