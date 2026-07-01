import type { BolaoDefinition } from "@/lib/boloes/definitions/types";
import { scopeMatchesForBolaoDefinition } from "@/lib/boloes/definitions/scope";
import { type MatchMap } from "@/lib/football-api";
import { calcPredictionPoints } from "@/lib/predictions";
import { getPool } from "@/lib/db";

export type DefinitionRankingRow = {
  ticketId: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  totalPoints: number;
  exactCount: number;
  outcomeCount: number;
  goalsCount: number;
  predictionsCount: number;
  firstSubmitAt: number;
  position: number;
};

type TicketRow = {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string;
  paid_at: Date | null;
  created_at: Date;
};

function sortRankingRows(
  rows: Omit<DefinitionRankingRow, "position">[],
): DefinitionRankingRow[] {
  return [...rows]
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
      if (b.outcomeCount !== a.outcomeCount) return b.outcomeCount - a.outcomeCount;
      if (b.goalsCount !== a.goalsCount) return b.goalsCount - a.goalsCount;
      return a.firstSubmitAt - b.firstSubmitAt;
    })
    .map((row, index) => ({ ...row, position: index + 1 }));
}

/** Ranking de cotas pagas de uma definição — só palpites nos jogos do escopo. */
export async function buildDefinitionRanking(
  def: BolaoDefinition,
  matches: MatchMap,
): Promise<DefinitionRankingRow[]> {
  const scoped = scopeMatchesForBolaoDefinition(def, matches);
  const scopedIds = scoped.map((m) => m.id);
  if (scopedIds.length === 0) return [];

  const pool = getPool();
  const { rows: tickets } = await pool.query<TicketRow>(
    `SELECT t.id, t.user_id, u.name AS user_name, u.email AS user_email, t.paid_at, t.created_at
       FROM tickets t
       JOIN users u ON u.id::text = t.user_id::text
      WHERE t.bolao_definition_id = $1
        AND t.status IN ('paid', 'approved')`,
    [def.id],
  );
  if (tickets.length === 0) return [];

  const ticketIds = tickets.map((t) => t.id);
  const { rows: predictions } = await pool.query<{
    ticket_id: string;
    match_id: number;
    score_casa: number;
    score_visitante: number;
    submitted_at: Date;
  }>(
    `SELECT ticket_id, match_id, score_casa, score_visitante, submitted_at
       FROM predictions
      WHERE ticket_id = ANY($1::uuid[])
        AND match_id = ANY($2::int[])`,
    [ticketIds, scopedIds],
  );

  const matchById = new Map(scoped.map((m) => [m.id, m]));
  const byTicket = new Map<string, Omit<DefinitionRankingRow, "position">>();

  for (const ticket of tickets) {
    byTicket.set(ticket.id, {
      ticketId: ticket.id,
      userId: ticket.user_id,
      userName: ticket.user_name,
      userEmail: ticket.user_email,
      totalPoints: 0,
      exactCount: 0,
      outcomeCount: 0,
      goalsCount: 0,
      predictionsCount: 0,
      firstSubmitAt: ticket.paid_at?.getTime() ?? ticket.created_at.getTime(),
    });
  }

  for (const p of predictions) {
    const match = matchById.get(p.match_id);
    const row = byTicket.get(p.ticket_id);
    if (!match || !row) continue;
    if (match.resultCasa == null || match.resultVisitante == null) continue;

    row.predictionsCount += 1;
    const pts = calcPredictionPoints(
      p.score_casa,
      p.score_visitante,
      match.resultCasa,
      match.resultVisitante,
    );
    row.totalPoints += pts.points;
    row.exactCount += pts.exact ? 1 : 0;
    row.outcomeCount += pts.outcomeHit ? 1 : 0;
    row.goalsCount += pts.goalsHitCount;
    const submitAt = p.submitted_at.getTime();
    if (submitAt < row.firstSubmitAt) row.firstSubmitAt = submitAt;
  }

  return sortRankingRows(Array.from(byTicket.values()));
}

export async function buildDefinitionRankingById(
  definitionId: string,
  matches: MatchMap,
): Promise<DefinitionRankingRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(`SELECT * FROM bolao_definitions WHERE id = $1 LIMIT 1`, [
    definitionId,
  ]);
  if (!rows[0]) return [];
  const { mapBolaoDefinitionRow } = await import("@/lib/boloes/definitions/mapper");
  const def = mapBolaoDefinitionRow(rows[0]!);
  return buildDefinitionRanking(def, matches);
}
