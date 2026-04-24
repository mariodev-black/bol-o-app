import { getPool } from "@/lib/db";

export type PredictionRow = {
  id: string;
  user_id: string;
  ticket_id: string;
  bolao_type: "principal" | "diario";
  match_id: number;
  score_casa: number;
  score_visitante: number;
  submitted_at: Date;
  updated_at: Date;
};

export function calcPredictionPoints(
  predCasa: number,
  predVisit: number,
  realCasa: number,
  realVisit: number
): { points: number; exact: boolean; outcomeHit: boolean; goalsHitCount: number } {
  const exact = predCasa === realCasa && predVisit === realVisit;
  if (exact) return { points: 6, exact: true, outcomeHit: true, goalsHitCount: 2 };
  const predDiff = predCasa - predVisit;
  const realDiff = realCasa - realVisit;
  const outcomeHit = (predDiff === 0 && realDiff === 0) || (predDiff > 0 && realDiff > 0) || (predDiff < 0 && realDiff < 0);
  const goalsHitCount = (predCasa === realCasa ? 1 : 0) + (predVisit === realVisit ? 1 : 0);
  let points = 0;
  if (outcomeHit) points += 3;
  points += goalsHitCount;
  return { points, exact: false, outcomeHit, goalsHitCount };
}

export async function upsertPrediction(input: {
  userId: string;
  ticketId: string;
  bolaoType: "principal" | "diario";
  matchId: number;
  scoreCasa: number;
  scoreVisitante: number;
}) {
  const pool = getPool();
  const { rows } = await pool.query<PredictionRow>(
    `INSERT INTO predictions (user_id, ticket_id, bolao_type, match_id, score_casa, score_visitante)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, ticket_id, match_id)
     DO UPDATE SET score_casa = EXCLUDED.score_casa, score_visitante = EXCLUDED.score_visitante, updated_at = now()
     RETURNING *`,
    [input.userId, input.ticketId, input.bolaoType, input.matchId, input.scoreCasa, input.scoreVisitante]
  );
  return rows[0]!;
}

export async function listPredictions(input: {
  userId: string;
  bolaoType?: "principal" | "diario";
  ticketId?: string;
}) {
  const pool = getPool();
  const params: unknown[] = [input.userId];
  let where = "WHERE user_id = $1";
  if (input.bolaoType) {
    params.push(input.bolaoType);
    where += ` AND bolao_type = $${params.length}`;
  }
  if (input.ticketId) {
    params.push(input.ticketId);
    where += ` AND ticket_id = $${params.length}`;
  }
  const { rows } = await pool.query<PredictionRow>(
    `SELECT * FROM predictions ${where} ORDER BY submitted_at ASC`,
    params
  );
  return rows;
}

export async function getPredictionByUserTicketMatch(input: {
  userId: string;
  ticketId: string;
  matchId: number;
}) {
  const pool = getPool();
  const { rows } = await pool.query<PredictionRow>(
    `SELECT *
     FROM predictions
     WHERE user_id = $1 AND ticket_id = $2 AND match_id = $3
     LIMIT 1`,
    [input.userId, input.ticketId, input.matchId]
  );
  return rows[0] ?? null;
}

