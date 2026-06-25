import type { PoolClient } from "pg";
import { listGroupStageDailyEditions } from "@/lib/boloes/daily-editions";
import { getFootballMainCompetitionId, parseExtraBolaoChampionshipIds } from "@/lib/boloes-extra-config";
import {
  calculateSkalePrizeAwards,
  calculateSkalePrizePoolCents,
} from "@/lib/boloes/skale-prize";
import {
  getSkaleBolaoCompetitionId,
  isSkaleBolaoCompetition,
} from "@/lib/boloes/skale-config";
import {
  getSkaleDailyBolaoCompetitionId,
  isSkaleDailyBolaoCompetition,
  isSkaleDailyBolaoEnabled,
} from "@/lib/boloes/skale-daily-config";
import {
  getWeekendBolaoCompetitionId,
  isWeekendBolaoCompetition,
} from "@/lib/boloes/weekend-bolao-config";
import { getPool } from "@/lib/db";

/** Log estruturado simples: `[prizes] {"t":"ISO","phase":"...","source":"..."}`. */
function prizesLog(phase: string, fields: Record<string, unknown> = {}): void {
  const payload = { t: new Date().toISOString(), phase, ...fields };
  try {
    console.info(`[prizes] ${JSON.stringify(payload)}`);
  } catch {
    console.info("[prizes]", phase, fields);
  }
}
import { calcPredictionPoints } from "@/lib/predictions";
import { calculatePrizeAwards, calculatePrizePoolCents } from "@/lib/prizes/distribution";

type BolaoPrizeType = "general" | "daily" | "extra";

type MatchRow = {
  match_id: number;
  status: string;
  kickoff_at: string | null;
  date_br: string;
  result_casa: number | null;
  result_visitante: number | null;
};

type TicketRow = {
  id: string;
  user_id: string;
  total_amount_cents: number;
  paid_at: Date | null;
  created_at: Date;
};

type PredictionRow = {
  ticket_id: string;
  user_id: string;
  match_id: number;
  score_casa: number;
  score_visitante: number;
  submitted_at: Date;
};

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

const PROCESS_LOCK_KEY = 7202602;

/**
 * Partida "resolvida" para premiacao: placar oficial preenchido OU situacao sem placar valido (cancel/adiado/suspens).
 * Nao basta "encerrado" sem gols — evita pagar antes do sync do placar.
 */
function isMatchResolvedForPrizes(match: Pick<MatchRow, "status" | "result_casa" | "result_visitante">): boolean {
  if (match.result_casa != null && match.result_visitante != null) return true;
  const status = String(match.status || "").trim().toLowerCase();
  return (
    status.includes("cancel") ||
    status.includes("adiad") ||
    status.includes("suspens") ||
    status.includes("interromp")
  );
}

function lastKickoffMs(matches: MatchRow[]): number | null {
  let maxMs = 0;
  for (const m of matches) {
    if (!m.kickoff_at) continue;
    const t = new Date(m.kickoff_at).getTime();
    if (Number.isFinite(t) && t > maxMs) maxMs = t;
  }
  return maxMs > 0 ? maxMs : null;
}

/** Minutos apos o apito do ultimo jogo do dia (DD/MM/AAAA) para fechar o bolao diario. Default 180 = 3h. */
function prizeDailyGraceAfterLastKickoffMinutes(): number {
  const n = Number.parseInt((process.env.PRIZE_DAILY_GRACE_AFTER_LAST_KICKOFF_MINUTES || "180").trim(), 10);
  if (!Number.isFinite(n)) return 180;
  return Math.min(600, Math.max(0, n));
}

/** Horas apos o apito do ultimo jogo da competicao (max kickoff no cache) para fechar o bolao geral. Default 36h. */
function prizeGeneralGraceHoursAfterLastKickoff(): number {
  const n = Number.parseFloat((process.env.PRIZE_GENERAL_GRACE_HOURS_AFTER_LAST_KICKOFF || "36").trim());
  if (!Number.isFinite(n) || n <= 0) return 36;
  return Math.min(168, n);
}

function hasScheduledFutureKickoff(matches: MatchRow[], nowMs: number): boolean {
  for (const m of matches) {
    if (!m.kickoff_at) continue;
    const t = new Date(m.kickoff_at).getTime();
    if (Number.isFinite(t) && t > nowMs) return true;
  }
  return false;
}

/** Bolao diario: todos resolvidos + ja passou a margem apos o ultimo apito daquele dia. */
function dailyPoolReadyForClosure(dateMatches: MatchRow[], nowMs: number): boolean {
  if (dateMatches.length === 0) return false;
  if (!dateMatches.every(isMatchResolvedForPrizes)) return false;
  const lastKo = lastKickoffMs(dateMatches);
  if (lastKo == null) return true;
  return nowMs >= lastKo + prizeDailyGraceAfterLastKickoffMinutes() * 60_000;
}

/** Bolao geral (Copa inteira): nenhum jogo futuro no cache, todos resolvidos, margem apos ultimo apito. */
function generalPoolReadyForClosure(matches: MatchRow[], nowMs: number): boolean {
  if (matches.length === 0) return false;
  if (hasScheduledFutureKickoff(matches, nowMs)) return false;
  if (!matches.every(isMatchResolvedForPrizes)) return false;
  const lastKo = lastKickoffMs(matches);
  if (lastKo == null) return true;
  return nowMs >= lastKo + prizeGeneralGraceHoursAfterLastKickoff() * 3600_000;
}

function closureKey(input: {
  competitionId: number;
  type: BolaoPrizeType;
  dateBR?: string | null;
  dailyEditionNumber?: number | null;
  skaleFinal?: boolean;
}): string {
  if (input.skaleFinal) return `${input.competitionId}:skale:final`;
  if (input.type === "general") return `${input.competitionId}:general`;
  if (input.type === "extra") return `${input.competitionId}:extra:${input.dateBR ?? "SEM_DATA"}`;
  if (input.dailyEditionNumber != null && input.dailyEditionNumber > 0) {
    return `${input.competitionId}:daily:edition:${input.dailyEditionNumber}`;
  }
  return `${input.competitionId}:daily:${input.dateBR ?? "SEM_DATA"}`;
}

async function ensurePrizeSchema(client: PoolClient) {
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
    `ALTER TABLE prize_closures ADD COLUMN IF NOT EXISTS processado boolean NOT NULL DEFAULT false`
  );
  await client.query(`
    UPDATE prize_closures pc
    SET processado = true, updated_at = now()
    WHERE pc.processado = false
      AND EXISTS (SELECT 1 FROM prize_awards pa WHERE pa.closure_id = pc.id)
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
  await client.query(`CREATE INDEX IF NOT EXISTS prize_closures_competition_idx ON prize_closures (competition_id, bolao_type)`);
  await client.query(`CREATE INDEX IF NOT EXISTS prize_awards_user_idx ON prize_awards (user_id)`);
}

async function listMatches(client: PoolClient, compId: number): Promise<MatchRow[]> {
  const { rows } = await client.query<MatchRow>(
    `SELECT match_id, status, kickoff_at::text, date_br, result_casa, result_visitante
     FROM matches_cache
     WHERE competition_id = $1
     ORDER BY match_id ASC`,
    [compId]
  );
  return rows;
}

async function insertClosure(
  client: PoolClient,
  input: {
    compId: number;
    type: BolaoPrizeType;
    dateBR: string | null;
    dailyEditionNumber?: number | null;
    totalRevenueCents: number;
    poolCents: number;
    metadata: Record<string, unknown>;
    skaleFinal?: boolean;
  }
): Promise<string | null> {
  const key = closureKey({
    competitionId: input.compId,
    type: input.type,
    dateBR: input.dateBR,
    dailyEditionNumber: input.dailyEditionNumber,
    skaleFinal: input.skaleFinal,
  });
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO prize_closures (
       closure_key, competition_id, bolao_type, date_br, status, processado, total_revenue_cents, pool_cents, metadata
     ) VALUES ($1, $2, $3, $4, 'processed', false, $5, $6, $7::jsonb)
     ON CONFLICT (closure_key) DO NOTHING
     RETURNING id`,
    [
      key,
      input.compId,
      input.type,
      input.dateBR,
      input.totalRevenueCents,
      input.poolCents,
      JSON.stringify(input.metadata),
    ]
  );
  return rows[0]?.id ?? null;
}

async function listTicketsForClosure(
  client: PoolClient,
  input: {
    type: BolaoPrizeType;
    dateBR?: string | null;
    competitionId: number;
    dailyEditionNumber?: number | null;
  },
): Promise<TicketRow[]> {
  if (input.type === "general") {
    const { rows } = await client.query<TicketRow>(
      `SELECT id::text AS id, user_id::text AS user_id, total_amount_cents, paid_at, created_at
       FROM tickets
       WHERE ticket_type = 'general'
         AND NOT COALESCE(is_promo_bonus, false)
         AND status IN ('paid', 'approved')
       ORDER BY paid_at ASC NULLS LAST, created_at ASC`
    );
    return rows;
  }

  if (input.type === "daily") {
    if (input.dailyEditionNumber != null && input.dailyEditionNumber > 0) {
      const edition = listGroupStageDailyEditions().find(
        (e) => e.number === input.dailyEditionNumber,
      );
      const dates = edition?.datesBR ?? [];
      const { rows } = await client.query<TicketRow>(
        `SELECT t.id::text AS id, t.user_id::text AS user_id, t.total_amount_cents, t.paid_at, t.created_at
         FROM tickets t
         WHERE t.ticket_type = 'daily'
           AND NOT COALESCE(t.is_promo_bonus, false)
           AND t.status IN ('paid', 'approved')
           AND t.round_number = $1
         ORDER BY t.paid_at ASC NULLS LAST, t.created_at ASC`,
        [input.dailyEditionNumber],
      );
      if (rows.length > 0 || dates.length === 0) return rows;
    }
    const { rows } = await client.query<TicketRow>(
      `WITH first_prediction_dates AS (
       SELECT DISTINCT ON (p.ticket_id) p.ticket_id, mc.date_br
       FROM predictions p
       JOIN matches_cache mc ON mc.match_id = p.match_id AND mc.competition_id = $2
       WHERE mc.date_br IS NOT NULL
       ORDER BY p.ticket_id, p.submitted_at ASC
     )
     SELECT t.id::text AS id, t.user_id::text AS user_id, t.total_amount_cents, t.paid_at, t.created_at
     FROM tickets t
     JOIN first_prediction_dates fpd ON fpd.ticket_id::text = t.id::text
     WHERE t.ticket_type = 'daily'
       AND NOT COALESCE(t.is_promo_bonus, false)
       AND t.status IN ('paid', 'approved')
       AND fpd.date_br = $1
     ORDER BY t.paid_at ASC NULLS LAST, t.created_at ASC`,
      [input.dateBR, input.competitionId]
    );
    return rows;
  }

  if (
    input.type === "extra" &&
    isSkaleDailyBolaoCompetition(input.competitionId) &&
    input.dailyEditionNumber != null &&
    input.dailyEditionNumber > 0
  ) {
    const { rows } = await client.query<TicketRow>(
      `SELECT t.id::text AS id, t.user_id::text AS user_id, t.total_amount_cents, t.paid_at, t.created_at
       FROM tickets t
       WHERE t.ticket_type = 'extra'
         AND t.extra_championship_id = $2
         AND t.round_number = $1
         AND NOT COALESCE(t.is_promo_bonus, false)
         AND t.status IN ('paid', 'approved')
       ORDER BY t.paid_at ASC NULLS LAST, t.created_at ASC`,
      [input.dailyEditionNumber, input.competitionId],
    );
    return rows;
  }

  const { rows } = await client.query<TicketRow>(
    `WITH first_prediction_dates AS (
       SELECT DISTINCT ON (p.ticket_id) p.ticket_id, mc.date_br
       FROM predictions p
       JOIN tickets t ON t.id::text = p.ticket_id::text
       JOIN matches_cache mc ON mc.match_id = p.match_id AND mc.competition_id = t.extra_championship_id
       WHERE p.bolao_type = 'extra'
         AND t.ticket_type = 'extra'
         AND t.extra_championship_id = $2
       ORDER BY p.ticket_id, p.submitted_at ASC
     )
     SELECT t.id::text AS id, t.user_id::text AS user_id, t.total_amount_cents, t.paid_at, t.created_at
     FROM tickets t
     JOIN first_prediction_dates fpd ON fpd.ticket_id::text = t.id::text
     WHERE t.ticket_type = 'extra'
       AND NOT COALESCE(t.is_promo_bonus, false)
       AND t.status IN ('paid', 'approved')
       AND fpd.date_br = $1
       AND t.extra_championship_id = $2
     ORDER BY t.paid_at ASC NULLS LAST, t.created_at ASC`,
    [input.dateBR, input.competitionId]
  );
  return rows;
}

async function listSkaleTicketsForClosure(
  client: PoolClient,
  skaleCompId: number,
): Promise<TicketRow[]> {
  const { rows } = await client.query<TicketRow>(
    `SELECT id::text AS id, user_id::text AS user_id, total_amount_cents, paid_at, created_at
     FROM tickets
     WHERE ticket_type = 'extra'
       AND extra_championship_id = $1
       AND NOT COALESCE(is_promo_bonus, false)
       AND status IN ('paid', 'approved')
     ORDER BY paid_at ASC NULLS LAST, created_at ASC`,
    [skaleCompId],
  );
  return rows;
}

async function listPredictionsForTickets(client: PoolClient, ticketIds: string[]): Promise<PredictionRow[]> {
  if (ticketIds.length === 0) return [];
  const { rows } = await client.query<PredictionRow>(
    `SELECT ticket_id::text AS ticket_id, user_id::text AS user_id, match_id, score_casa, score_visitante, submitted_at
     FROM predictions
     WHERE ticket_id::text = ANY($1::text[])
     ORDER BY submitted_at ASC`,
    [ticketIds]
  );
  return rows;
}

function buildRanking(input: { tickets: TicketRow[]; predictions: PredictionRow[]; matches: MatchRow[] }): RankingRow[] {
  const matchMap = new Map(input.matches.map((match) => [Number(match.match_id), match]));
  const predictionsByTicket = new Map<string, PredictionRow[]>();
  for (const prediction of input.predictions) {
    const arr = predictionsByTicket.get(prediction.ticket_id) ?? [];
    arr.push(prediction);
    predictionsByTicket.set(prediction.ticket_id, arr);
  }

  const rows: RankingRow[] = input.tickets.map((ticket) => {
    const predictions = (predictionsByTicket.get(ticket.id) ?? []).sort((a, b) => {
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

    for (const prediction of predictions) {
      const match = matchMap.get(Number(prediction.match_id));
      if (!match || match.result_casa == null || match.result_visitante == null) continue;
      const calc = calcPredictionPoints(
        prediction.score_casa,
        prediction.score_visitante,
        match.result_casa,
        match.result_visitante
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

    return {
      ticketId: ticket.id,
      userId: ticket.user_id,
      totalPoints,
      exactCount,
      outcomeCount,
      goalsCount,
      bestStreak,
      firstSubmitAt,
    };
  });

  return rows.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
    if (b.outcomeCount !== a.outcomeCount) return b.outcomeCount - a.outcomeCount;
    if (b.goalsCount !== a.goalsCount) return b.goalsCount - a.goalsCount;
    if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
    return a.firstSubmitAt - b.firstSubmitAt;
  });
}

async function creditAward(
  client: PoolClient,
  input: {
    closureId: string;
    compId: number;
    type: BolaoPrizeType;
    dateBR: string | null;
    rank: number;
    amountCents: number;
    ranking: RankingRow;
  }
) {
  const description =
    input.type === "general"
      ? `Premiacao Bolao Geral - Ticket ${input.ranking.ticketId} - ${input.rank} lugar`
      : input.type === "extra" && isSkaleBolaoCompetition(input.compId)
        ? `Premiacao Bolao da Skale - Ticket ${input.ranking.ticketId} - ${input.rank} lugar`
        : input.type === "extra"
          ? `Premiacao Bolao Extra (${input.compId}) ${input.dateBR} - Ticket ${input.ranking.ticketId} - ${input.rank} lugar`
          : `Premiacao Bolao Diario ${input.dateBR} - Ticket ${input.ranking.ticketId} - ${input.rank} lugar`;
  const metadata = {
    description,
    competitionId: input.compId,
    bolaoType: input.type,
    dateBR: input.dateBR,
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
    ]
  );
  const awardId = awardInsert.rows[0]?.id;
  if (!awardId) return;

  /** Uma linha de crédito por fechamento+colocação: evita saldo em duplicidade se o job repetir ou houver reentrância. */
  const externalRef = `internal_prize:${input.closureId}:rank:${input.rank}`;
  const existingTx = await client.query<{ id: string }>(
    `SELECT id FROM transactions
     WHERE provider = 'internal_prize' AND external_ref = $1 AND user_id = $2::uuid
     LIMIT 1`,
    [externalRef, input.ranking.userId]
  );
  const priorTxId = existingTx.rows[0]?.id;
  if (priorTxId) {
    await client.query(
      `UPDATE prize_awards SET transaction_id = COALESCE(transaction_id, $2::uuid) WHERE id = $1`,
      [awardId, priorTxId]
    );
    return;
  }

  const tx = await client.query<{ id: string }>(
    `INSERT INTO transactions (
       user_id, ticket_id, ticket_type, provider, status, amount_cents, payment_method, external_ref, raw_request, raw_response
     ) VALUES ($1::uuid, $2::uuid, $3::ticket_type_enum, 'internal_prize', 'paid', $4, 'wallet', $5, $6::jsonb, $6::jsonb)
     RETURNING id`,
    [
      input.ranking.userId,
      input.ranking.ticketId,
      input.type === "general" ? "general" : input.type === "extra" ? "extra" : "daily",
      input.amountCents,
      externalRef,
      JSON.stringify(metadata),
    ]
  );

  await client.query(
    `UPDATE prize_awards
     SET transaction_id = $2
     WHERE id = $1`,
    [awardId, tx.rows[0]!.id]
  );
  await client.query(
    `UPDATE users
     SET balance_cents = COALESCE(balance_cents, 0) + $2
     WHERE id = $1::uuid`,
    [input.ranking.userId, input.amountCents]
  );
}

async function processClosure(
  client: PoolClient,
  input: {
    compId: number;
    type: BolaoPrizeType;
    dateBR: string | null;
    dailyEditionNumber?: number | null;
    matches: MatchRow[];
    metadataExtra?: Record<string, unknown>;
  }
) {
  const tickets = await listTicketsForClosure(client, {
    type: input.type,
    dateBR: input.dateBR,
    competitionId: input.compId,
    dailyEditionNumber: input.dailyEditionNumber,
  });
  const totalRevenueCents = tickets.reduce((sum, ticket) => sum + Number(ticket.total_amount_cents || 0), 0);
  const poolCents = calculatePrizePoolCents(totalRevenueCents, input.type);
  if (tickets.length === 0 || poolCents <= 0) return;

  const closureId = await insertClosure(client, {
    compId: input.compId,
    type: input.type,
    dateBR: input.dateBR,
    dailyEditionNumber: input.dailyEditionNumber,
    totalRevenueCents,
    poolCents,
    metadata: {
      ticketCount: tickets.length,
      matchCount: input.matches.length,
      ...(input.metadataExtra ?? {}),
    },
  });
  if (!closureId) return;

  const predictions = await listPredictionsForTickets(client, tickets.map((ticket) => ticket.id));
  const ranking = buildRanking({ tickets, predictions, matches: input.matches });
  const awardAmounts = calculatePrizeAwards(poolCents, ranking.length, input.type);
  for (const award of awardAmounts) {
    const row = ranking[award.rank - 1];
    if (!row) continue;
    await creditAward(client, {
      closureId,
      compId: input.compId,
      type: input.type,
      dateBR: input.dateBR,
      rank: award.rank,
      amountCents: award.amountCents,
      ranking: row,
    });
  }

  await client.query(
    `UPDATE prize_closures SET processado = true, updated_at = now() WHERE id = $1 AND processado = false`,
    [closureId]
  );

  // ─── Encerramento idempotente do ticket ─────────────────────────────
  // Marca TODOS os tickets que participaram deste closure como `settled_at`.
  // - Idempotência: COALESCE preserva o `settled_at` original em reexecuções;
  //   `settled_closure_id` indica QUAL closure encerrou (auditável).
  // - Reentrância: como `prize_closures.closure_key` é UNIQUE e bloqueamos
  //   via advisory_lock, dois sync simultâneos NUNCA criam closure duplicado;
  //   o UPDATE abaixo só "marca novidade" no primeiro caminho real.
  if (tickets.length > 0) {
    const ticketIds = tickets.map((t) => t.id);
    await client.query(
      `UPDATE tickets
         SET settled_at = COALESCE(settled_at, now()),
             settled_closure_id = COALESCE(settled_closure_id, $2::uuid),
             updated_at = now()
       WHERE id::text = ANY($1::text[])
         AND settled_at IS NULL`,
      [ticketIds, closureId],
    );
  }
}

async function processSkaleClosure(
  client: PoolClient,
  input: {
    compId: number;
    matches: MatchRow[];
    metadataExtra?: Record<string, unknown>;
  },
) {
  const tickets = await listSkaleTicketsForClosure(client, input.compId);
  const totalRevenueCents = tickets.reduce(
    (sum, ticket) => sum + Number(ticket.total_amount_cents || 0),
    0,
  );
  const poolCents = calculateSkalePrizePoolCents(totalRevenueCents);
  if (tickets.length === 0 || poolCents <= 0) return;

  const closureId = await insertClosure(client, {
    compId: input.compId,
    type: "extra",
    dateBR: null,
    totalRevenueCents,
    poolCents,
    skaleFinal: true,
    metadata: {
      ticketCount: tickets.length,
      matchCount: input.matches.length,
      prizeModel: "skale_top3_percent",
      sharesBps: { first: 6000, second: 3000, third: 1000 },
      ...(input.metadataExtra ?? {}),
    },
  });
  if (!closureId) return;

  const predictions = await listPredictionsForTickets(client, tickets.map((ticket) => ticket.id));
  const ranking = buildRanking({ tickets, predictions, matches: input.matches });
  const awardAmounts = calculateSkalePrizeAwards(totalRevenueCents);

  for (const award of awardAmounts) {
    const row = ranking[award.rank - 1];
    if (!row) continue;
    await creditAward(client, {
      closureId,
      compId: input.compId,
      type: "extra",
      dateBR: null,
      rank: award.rank,
      amountCents: award.amountCents,
      ranking: row,
    });
  }

  await client.query(
    `UPDATE prize_closures SET processado = true, updated_at = now() WHERE id = $1 AND processado = false`,
    [closureId],
  );

  if (tickets.length > 0) {
    const ticketIds = tickets.map((t) => t.id);
    await client.query(
      `UPDATE tickets
         SET settled_at = COALESCE(settled_at, now()),
             settled_closure_id = COALESCE(settled_closure_id, $2::uuid),
             updated_at = now()
       WHERE id::text = ANY($1::text[])
         AND settled_at IS NULL`,
      [ticketIds, closureId],
    );
  }
}

export async function processPrizeClosuresAfterMatchSync(
  logCtx?: { tickId?: string; source?: string }
): Promise<void> {
  const plog = (phase: string, fields: Record<string, unknown> = {}) => {
    if (!logCtx?.source) return;
    prizesLog(phase, { ...logCtx, ...fields });
  };
  const pool = getPool();
  const client = await pool.connect();
  let locked = false;
  try {
    await ensurePrizeSchema(client);
    const lockResult = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [PROCESS_LOCK_KEY]);
    locked = Boolean(lockResult.rows[0]?.locked);
    if (!locked) {
      plog("skip-lock-busy", {});
      return;
    }
    plog("lock-acquired", {});

    const compId = getFootballMainCompetitionId();
    const matches = await listMatches(client, compId);
    const nowMs = Date.now();

    if (matches.length > 0) {
      for (const edition of listGroupStageDailyEditions()) {
        const dateSet = new Set(edition.datesBR);
        const editionMatches = matches.filter(
          (match) => match.date_br != null && dateSet.has(match.date_br),
        );
        if (!dailyPoolReadyForClosure(editionMatches, nowMs)) continue;
        await client.query("BEGIN");
        try {
          await processClosure(client, {
            compId,
            type: "daily",
            dateBR: edition.datesBR[edition.datesBR.length - 1] ?? null,
            dailyEditionNumber: edition.number,
            matches: editionMatches,
            metadataExtra: {
              prizeGate: "daily-edition",
              dailyEditionNumber: edition.number,
              editionDates: edition.datesBR,
              lastKickoffMs: lastKickoffMs(editionMatches),
              graceMinutesAfterLastKickoff: prizeDailyGraceAfterLastKickoffMinutes(),
            },
          });
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }

      const skaleDailyComp = getSkaleDailyBolaoCompetitionId();
      if (isSkaleDailyBolaoEnabled()) {
        const skaleDailyMatches = await listMatches(client, skaleDailyComp);
        const editionSourceMatches =
          skaleDailyMatches.length > 0 ? skaleDailyMatches : matches;
        for (const edition of listGroupStageDailyEditions()) {
          const dateSet = new Set(edition.datesBR);
          const editionMatches = editionSourceMatches.filter(
            (match) => match.date_br != null && dateSet.has(match.date_br),
          );
          if (!dailyPoolReadyForClosure(editionMatches, nowMs)) continue;
          await client.query("BEGIN");
          try {
            await processClosure(client, {
              compId: skaleDailyComp,
              type: "extra",
              dateBR: edition.datesBR[edition.datesBR.length - 1] ?? null,
              dailyEditionNumber: edition.number,
              matches: editionMatches,
              metadataExtra: {
                prizeGate: "skale-daily-edition",
                dailyEditionNumber: edition.number,
                editionDates: edition.datesBR,
                lastKickoffMs: lastKickoffMs(editionMatches),
                graceMinutesAfterLastKickoff: prizeDailyGraceAfterLastKickoffMinutes(),
              },
            });
            await client.query("COMMIT");
          } catch (error) {
            await client.query("ROLLBACK");
            throw error;
          }
        }
      }

      if (generalPoolReadyForClosure(matches, nowMs)) {
        await client.query("BEGIN");
        try {
          await processClosure(client, {
            compId,
            type: "general",
            dateBR: null,
            matches,
            metadataExtra: {
              prizeGate: "general",
              lastKickoffMs: lastKickoffMs(matches),
              graceHoursAfterLastKickoff: prizeGeneralGraceHoursAfterLastKickoff(),
            },
          });
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
    }

    for (const extraComp of parseExtraBolaoChampionshipIds()) {
      if (
        isSkaleBolaoCompetition(extraComp) ||
        isWeekendBolaoCompetition(extraComp) ||
        isSkaleDailyBolaoCompetition(extraComp)
      ) {
        continue;
      }
      const matchesExtra = await listMatches(client, extraComp);
      if (matchesExtra.length === 0) continue;
      const byDateExtra = new Map<string, MatchRow[]>();
      for (const match of matchesExtra) {
        if (!match.date_br) continue;
        const arr = byDateExtra.get(match.date_br) ?? [];
        arr.push(match);
        byDateExtra.set(match.date_br, arr);
      }
      for (const [dateBR, dateMatches] of byDateExtra) {
        if (!dailyPoolReadyForClosure(dateMatches, nowMs)) continue;
        await client.query("BEGIN");
        try {
          await processClosure(client, {
            compId: extraComp,
            type: "extra",
            dateBR,
            matches: dateMatches,
            metadataExtra: {
              prizeGate: "extra",
              lastKickoffMs: lastKickoffMs(dateMatches),
              graceMinutesAfterLastKickoff: prizeDailyGraceAfterLastKickoffMinutes(),
            },
          });
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
    }

    const skaleComp = getSkaleBolaoCompetitionId();
    if (isSkaleBolaoCompetition(skaleComp)) {
      const skaleMatches = await listMatches(client, skaleComp);
      if (skaleMatches.length > 0 && generalPoolReadyForClosure(skaleMatches, nowMs)) {
        await client.query("BEGIN");
        try {
          await processSkaleClosure(client, {
            compId: skaleComp,
            matches: skaleMatches,
            metadataExtra: {
              prizeGate: "skale_final_copa",
              lastKickoffMs: lastKickoffMs(skaleMatches),
              graceHoursAfterLastKickoff: prizeGeneralGraceHoursAfterLastKickoff(),
            },
          });
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
    }

    const weekendComp = getWeekendBolaoCompetitionId();
    if (isWeekendBolaoCompetition(weekendComp)) {
      const weekendMatches = await listMatches(client, weekendComp);
      if (weekendMatches.length > 0 && generalPoolReadyForClosure(weekendMatches, nowMs)) {
        await client.query("BEGIN");
        try {
          await processSkaleClosure(client, {
            compId: weekendComp,
            matches: weekendMatches,
            metadataExtra: {
              prizeGate: "weekend_pool",
              lastKickoffMs: lastKickoffMs(weekendMatches),
              graceHoursAfterLastKickoff: prizeGeneralGraceHoursAfterLastKickoff(),
            },
          });
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
    }

    plog("complete", {});
  } catch (error) {
    plog("error", { message: error instanceof Error ? error.message : String(error) });
    console.error("[prizes] failed to process prize closures", error);
  } finally {
    if (locked) {
      await client.query("SELECT pg_advisory_unlock($1)", [PROCESS_LOCK_KEY]).catch(() => {});
    }
    client.release();
  }
}
