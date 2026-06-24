import {
  adminTicketBolaoType,
  assertMatchInAdminTicketScope,
} from "@/lib/admin/ticket-scope-predictions";
import {
  adminUpdateMatchResultInCache,
  competitionIdsForAdminTicketMatch,
} from "@/lib/admin/admin-update-match-result";
import type { AdminTicketPredictionItem } from "@/lib/admin/sections";
import { getPool } from "@/lib/db";
import type { PredictionRow } from "@/lib/predictions";
import { recomputePredictionScoreForPrediction } from "@/lib/predictions/score-recompute";
import { getTicketLiveTotals, type TicketLiveTotals } from "@/lib/predictions/scores-aggregate";
import { scopeMatchesForPaidTicket } from "@/lib/boloes/ticket-match-scope";
import { fetchMatchesMapDirectFromDb } from "@/lib/football-api";
import { invalidateMatchMapMemoryAfterDbWrite } from "@/lib/match-map-cache-invalidator";

export type AdminSaveTicketPredictionInput = {
  ticketId: string;
  matchId: number;
  competitionId?: number | null;
  resultCasa?: number | null;
  resultVisitante?: number | null;
  scoreCasa: number;
  scoreVisitante: number;
  pointsOverride?: number | null;
};

export type AdminUpsertPredictionResult = {
  prediction: AdminTicketPredictionItem;
  ticketTotals: TicketLiveTotals;
};

export async function adminSaveTicketPrediction(
  input: AdminSaveTicketPredictionInput,
): Promise<AdminUpsertPredictionResult> {
  const context = await assertMatchInAdminTicketScope(input.ticketId, input.matchId);
  const bolaoType = adminTicketBolaoType(context.ticketRow.ticket_type);
  const hasResultUpdate =
    input.resultCasa != null &&
    input.resultVisitante != null &&
    Number.isInteger(input.resultCasa) &&
    Number.isInteger(input.resultVisitante);

  const pool = getPool();
  const client = await pool.connect();

  let predictionId: string;
  try {
    await client.query("BEGIN");

    if (hasResultUpdate) {
      const competitionIds = competitionIdsForAdminTicketMatch(
        {
          ticketType: context.ticketRow.ticket_type,
          extraChampionshipId: context.ticketRow.extra_championship_id,
          roundNumber: context.ticketRow.round_number,
        },
        input.competitionId,
      );
      const { rowCount } = await client.query(
        `UPDATE matches_cache
         SET result_casa = $2,
             result_visitante = $3,
             source_updated_at = now(),
             synced_at = now()
         WHERE match_id = $1
           AND competition_id = ANY($4::int[])`,
        [input.matchId, input.resultCasa, input.resultVisitante, competitionIds],
      );
      if (!rowCount) {
        throw new Error("Partida não encontrada no cache");
      }
    }

    const { rows } = await client.query<PredictionRow>(
      `INSERT INTO predictions (user_id, ticket_id, bolao_type, match_id, score_casa, score_visitante)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, ticket_id, match_id)
       DO UPDATE SET
         score_casa = EXCLUDED.score_casa,
         score_visitante = EXCLUDED.score_visitante,
         updated_at = now()
       RETURNING *`,
      [
        context.ticketRow.user_id,
        input.ticketId,
        bolaoType,
        input.matchId,
        input.scoreCasa,
        input.scoreVisitante,
      ],
    );
    const saved = rows[0];
    if (!saved) throw new Error("Falha ao salvar palpite");
    predictionId = saved.id;

    await recomputePredictionScoreForPrediction(client, predictionId);

    if (
      input.pointsOverride != null &&
      Number.isInteger(input.pointsOverride) &&
      input.pointsOverride >= 0
    ) {
      await client.query(
        `UPDATE prediction_scores
         SET points = $2, computed_at = now()
         WHERE prediction_id = $1::uuid`,
        [predictionId, input.pointsOverride],
      );
    }

    await client.query("COMMIT");
    if (hasResultUpdate) invalidateMatchMapMemoryAfterDbWrite();
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const matchMap = await fetchMatchesMapDirectFromDb();
  const scopeMatches = scopeMatchesForPaidTicket(context.paidTicket, matchMap);
  const match = scopeMatches.find((entry) => Number(entry.id) === input.matchId);

  const { rows: scoreRows } = await pool.query<{
    points: string | number | null;
    submitted_at: Date;
    updated_at: Date;
  }>(
    `SELECT
       COALESCE(ps.points, 0) AS points,
       p.submitted_at,
       p.updated_at
     FROM predictions p
     LEFT JOIN prediction_scores ps ON ps.prediction_id = p.id
     WHERE p.id = $1::uuid`,
    [predictionId],
  );
  const scoreRow = scoreRows[0];

  const prediction: AdminTicketPredictionItem = {
    id: predictionId,
    matchId: input.matchId,
    competitionId: input.competitionId ?? (match ? Number(match.competitionId) : null),
    hasPrediction: true,
    homeName: match?.homeName ?? "Time casa",
    awayName: match?.awayName ?? "Time visitante",
    homeLogo: match?.homeLogo ?? null,
    awayLogo: match?.awayLogo ?? null,
    dateBR: match?.dateBR ?? null,
    hourBR: match?.hour ?? null,
    status: match?.status ?? null,
    scoreCasa: input.scoreCasa,
    scoreVisitante: input.scoreVisitante,
    resultCasa: hasResultUpdate ? input.resultCasa! : (match?.resultCasa ?? null),
    resultVisitante: hasResultUpdate ? input.resultVisitante! : (match?.resultVisitante ?? null),
    points: Number(scoreRow?.points ?? 0),
    submittedAt: scoreRow?.submitted_at.toISOString() ?? new Date().toISOString(),
    updatedAt: scoreRow?.updated_at.toISOString() ?? new Date().toISOString(),
  };

  const ticketTotals = await getTicketLiveTotals(input.ticketId);
  return { prediction, ticketTotals };
}

/** @deprecated use adminSaveTicketPrediction */
export async function adminUpsertTicketPrediction(input: {
  ticketId: string;
  matchId: number;
  scoreCasa: number;
  scoreVisitante: number;
}): Promise<AdminUpsertPredictionResult> {
  return adminSaveTicketPrediction(input);
}
