import { getPool } from "@/lib/db";
import type { PredictionBolaoType } from "./palpites-kickoff-lock";
export type { PredictionBolaoType } from "./palpites-kickoff-lock";
export {
  PALPITE_LOCK_BEFORE_KICKOFF_MS_DEFAULT,
  PALPITE_LOCK_BEFORE_KICKOFF_MS_EXTRA,
  palpiteLockBeforeKickoffMs,
} from "./palpites-kickoff-lock";

export type PredictionRow = {
  id: string;
  user_id: string;
  ticket_id: string;
  bolao_type: PredictionBolaoType;
  match_id: number;
  score_casa: number;
  score_visitante: number;
  submitted_at: Date;
  updated_at: Date;
};

/** Campos mínimos para agregar pontos no ranking (menos I/O e memória). */
export type PredictionAggregateRow = {
  ticket_id: string;
  match_id: number;
  score_casa: number;
  score_visitante: number;
  submitted_at: Date;
};

/** Campos usados no ranking global da tela de bolões (sem SELECT *). */
export type PredictionRankingRow = {
  ticket_id: string;
  bolao_type: PredictionBolaoType;
  match_id: number;
  score_casa: number;
  score_visitante: number;
  submitted_at: Date;
};

const PREDICTION_COLUMNS =
  "id, user_id, ticket_id, bolao_type, match_id, score_casa, score_visitante, submitted_at, updated_at";

export function calcPredictionPoints(
  predCasa: number,
  predVisit: number,
  realCasa: number,
  realVisit: number
): { points: number; exact: boolean; outcomeHit: boolean; goalsHitCount: number } {
  const exact = predCasa === realCasa && predVisit === realVisit;
  if (exact) return { points: 6, exact: true, outcomeHit: true, goalsHitCount: 0 };
  const predDiff = predCasa - predVisit;
  const realDiff = realCasa - realVisit;
  const outcomeHit = (predDiff === 0 && realDiff === 0) || (predDiff > 0 && realDiff > 0) || (predDiff < 0 && realDiff < 0);
  const goalsHitCount = (predCasa === realCasa ? 1 : 0) + (predVisit === realVisit ? 1 : 0);
  if (outcomeHit) return { points: goalsHitCount > 0 ? 4 : 3, exact: false, outcomeHit: true, goalsHitCount };
  return { points: goalsHitCount, exact: false, outcomeHit: false, goalsHitCount };
}

export async function upsertPrediction(input: {
  userId: string;
  ticketId: string;
  bolaoType: PredictionBolaoType;
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
  bolaoType?: PredictionBolaoType;
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
    `SELECT id, user_id, ticket_id, bolao_type, match_id, score_casa, score_visitante, submitted_at, updated_at
     FROM predictions ${where} ORDER BY submitted_at ASC`,
    params
  );
  return rows;
}

/** Apenas ticket + partida — bem mais barato que listPredictions para telas de cotas. */
export async function listPredictionTicketMatchPairsForUser(
  userId: string
): Promise<Array<{ ticket_id: string; match_id: number }>> {
  const pool = getPool();
  const { rows } = await pool.query<{ ticket_id: string; match_id: string | number }>(
    `SELECT ticket_id, match_id FROM predictions WHERE user_id = $1`,
    [userId]
  );
  return rows.map((r) => ({
    ticket_id: r.ticket_id,
    match_id: Number(r.match_id),
  }));
}

export async function listPredictionsForTicketAllUsers(ticketId: string): Promise<PredictionRow[]> {
  const pool = getPool();
  const { rows } = await pool.query<PredictionRow>(
    `SELECT ${PREDICTION_COLUMNS} FROM predictions WHERE ticket_id = $1 ORDER BY submitted_at ASC`,
    [ticketId]
  );
  return rows;
}

/** Match ids do ticket (para data do bolão diário) — query leve. */
export async function listMatchIdsForTicketPredictions(ticketId: string): Promise<number[]> {
  const pool = getPool();
  const { rows } = await pool.query<{ match_id: string | number }>(
    `SELECT DISTINCT match_id FROM predictions WHERE ticket_id = $1`,
    [ticketId]
  );
  const out: number[] = [];
  for (const r of rows) {
    const n = Number(r.match_id);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

export async function listAllPredictionsByBolao(bolaoType: PredictionBolaoType): Promise<PredictionRow[]> {
  const pool = getPool();
  const { rows } = await pool.query<PredictionRow>(
    `SELECT ${PREDICTION_COLUMNS} FROM predictions WHERE bolao_type = $1 ORDER BY submitted_at ASC`,
    [bolaoType]
  );
  return rows;
}

/** Predições para agregação de ranking — sem SELECT *. */
export async function listPredictionsAggregateByBolao(
  bolaoType: "principal" | "diario" | "extra"
): Promise<PredictionAggregateRow[]> {
  const pool = getPool();
  const { rows } = await pool.query<{
    ticket_id: string;
    match_id: string | number;
    score_casa: number;
    score_visitante: number;
    submitted_at: Date;
  }>(
    `SELECT ticket_id, match_id, score_casa, score_visitante, submitted_at
     FROM predictions WHERE bolao_type = $1`,
    [bolaoType]
  );
  return rows.map((r) => ({
    ticket_id: r.ticket_id,
    match_id: Number(r.match_id),
    score_casa: r.score_casa,
    score_visitante: r.score_visitante,
    submitted_at: r.submitted_at,
  }));
}

/** Ranking global (bolões): só colunas necessárias — evita SELECT * em tabela grande. */
export async function listPredictionsForGlobalRanking(): Promise<PredictionRankingRow[]> {
  const pool = getPool();
  const { rows } = await pool.query<{
    ticket_id: string;
    bolao_type: PredictionBolaoType;
    match_id: string | number;
    score_casa: number;
    score_visitante: number;
    submitted_at: Date;
  }>(
    `SELECT ticket_id, bolao_type, match_id, score_casa, score_visitante, submitted_at
     FROM predictions`
  );
  return rows.map((r) => ({
    ticket_id: r.ticket_id,
    bolao_type: r.bolao_type,
    match_id: Number(r.match_id),
    score_casa: r.score_casa,
    score_visitante: r.score_visitante,
    submitted_at: r.submitted_at,
  }));
}

export async function listDistinctExtraPredictionTicketIds(): Promise<string[]> {
  const pool = getPool();
  const { rows } = await pool.query<{ ticket_id: string }>(
    `SELECT DISTINCT ticket_id::text AS ticket_id FROM predictions WHERE bolao_type = 'extra'`
  );
  return rows.map((r) => String(r.ticket_id).trim()).filter(Boolean);
}

/** @deprecated Prefira `listPredictionsForGlobalRanking`. */
export async function listAllPredictions(): Promise<PredictionRow[]> {
  const pool = getPool();
  const { rows } = await pool.query<PredictionRow>(
    `SELECT ${PREDICTION_COLUMNS} FROM predictions ORDER BY submitted_at ASC`
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
    `SELECT ${PREDICTION_COLUMNS}
     FROM predictions
     WHERE user_id = $1 AND ticket_id = $2 AND match_id = $3
     LIMIT 1`,
    [input.userId, input.ticketId, input.matchId]
  );
  return rows[0] ?? null;
}

