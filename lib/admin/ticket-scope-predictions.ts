import { getBolaoDefinitionById } from "@/lib/boloes/definitions/repository";
import { paidTicketDailyEditionNumber } from "@/lib/boloes/daily-editions";
import {
  isSkaleDailyBolaoCompetition,
  paidTicketSkaleDailyEditionNumber,
} from "@/lib/boloes/skale-daily-config";
import { scopeMatchesForPaidTicket } from "@/lib/boloes/ticket-match-scope";
import { getPool } from "@/lib/db";
import { fetchMatchesMapDirectFromDb, type MatchMapEntry } from "@/lib/football-api";
import type { PaidTicketRow } from "@/lib/payments/user-tickets";
import type { AdminTicketPredictionItem } from "@/lib/admin/sections";

type AdminTicketDbRow = {
  id: string;
  user_id: string;
  ticket_type: string;
  extra_championship_id: number | null;
  round_number: number | null;
  bolao_definition_id: string | null;
  paid_at: Date | null;
  created_at: Date;
  quantity: number;
};

export type AdminTicketScopeContext = {
  ticketRow: AdminTicketDbRow;
  paidTicket: PaidTicketRow;
  scopeMatches: MatchMapEntry[];
};

async function loadAdminTicketScopeContext(ticketId: string): Promise<AdminTicketScopeContext | null> {
  const pool = getPool();
  const { rows } = await pool.query<AdminTicketDbRow>(
    `SELECT
       id::text,
       user_id::text,
       ticket_type,
       extra_championship_id,
       round_number,
       bolao_definition_id::text,
       paid_at,
       created_at,
       quantity
     FROM tickets
     WHERE id::text = $1
     LIMIT 1`,
    [ticketId],
  );
  const ticketRow = rows[0];
  if (!ticketRow) return null;

  const bolaoDefinition = ticketRow.bolao_definition_id
    ? await getBolaoDefinitionById(ticketRow.bolao_definition_id)
    : null;

  const paidTicket: PaidTicketRow = {
    id: ticketRow.id,
    ticketType: ticketRow.ticket_type as PaidTicketRow["ticketType"],
    quantity: ticketRow.quantity,
    paidAt: ticketRow.paid_at ? ticketRow.paid_at.toISOString() : null,
    createdAt: ticketRow.created_at.toISOString(),
    extraChampionshipId: ticketRow.extra_championship_id,
    extraRoundNumber: ticketRow.round_number,
    dailyEditionNumber:
      ticketRow.ticket_type === "daily"
        ? paidTicketDailyEditionNumber({
            ticketType: "daily",
            round_number: ticketRow.round_number,
          })
        : null,
    skaleDailyEditionNumber:
      ticketRow.ticket_type === "extra" &&
      isSkaleDailyBolaoCompetition(ticketRow.extra_championship_id)
        ? paidTicketSkaleDailyEditionNumber({
            ticketType: "extra",
            extraChampionshipId: ticketRow.extra_championship_id,
            round_number: ticketRow.round_number,
          })
        : null,
    bolaoDefinitionId: ticketRow.bolao_definition_id,
    bolaoDefinition,
  };

  const matchMap = await fetchMatchesMapDirectFromDb();
  const scopeMatches = scopeMatchesForPaidTicket(paidTicket, matchMap);
  scopeMatches.sort((a, b) => {
    const kickoffA = a.kickoffAt ?? "";
    const kickoffB = b.kickoffAt ?? "";
    if (kickoffA !== kickoffB) return kickoffA.localeCompare(kickoffB);
    const dateA = a.dateBR ?? "";
    const dateB = b.dateBR ?? "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return Number(a.id) - Number(b.id);
  });

  return { ticketRow, paidTicket, scopeMatches };
}

function matchEntryToScopeItem(
  match: MatchMapEntry,
  prediction:
    | {
        id: string;
        score_casa: number;
        score_visitante: number;
        submitted_at: Date;
        updated_at: Date;
        points: number;
      }
    | undefined,
): AdminTicketPredictionItem | null {
  const matchId = Number(match.id);
  if (!Number.isFinite(matchId) || matchId <= 0) return null;

  return {
    id: prediction?.id ?? null,
    matchId,
    competitionId: Number.isFinite(Number(match.competitionId)) ? Number(match.competitionId) : null,
    hasPrediction: prediction != null,
    homeName: match.homeName ?? "Time casa",
    awayName: match.awayName ?? "Time visitante",
    homeLogo: match.homeLogo ?? null,
    awayLogo: match.awayLogo ?? null,
    dateBR: match.dateBR ?? null,
    hourBR: match.hour ?? null,
    status: match.status ?? null,
    scoreCasa: prediction?.score_casa ?? null,
    scoreVisitante: prediction?.score_visitante ?? null,
    resultCasa: match.resultCasa ?? null,
    resultVisitante: match.resultVisitante ?? null,
    points: prediction?.points ?? 0,
    submittedAt: prediction?.submitted_at.toISOString() ?? null,
    updatedAt: prediction?.updated_at.toISOString() ?? null,
  };
}

export async function listAdminTicketScopePredictions(ticketId: string): Promise<{
  items: AdminTicketPredictionItem[];
  totalMatchesCount: number;
  predictionsCount: number;
  pendingPredictionsCount: number;
} | null> {
  const context = await loadAdminTicketScopeContext(ticketId);
  if (!context) return null;

  const pool = getPool();
  const { rows: predictionRows } = await pool.query<{
    id: string;
    match_id: number;
    score_casa: number;
    score_visitante: number;
    submitted_at: Date;
    updated_at: Date;
    points: string | number | null;
  }>(
    `SELECT
       p.id,
       p.match_id,
       p.score_casa,
       p.score_visitante,
       p.submitted_at,
       p.updated_at,
       COALESCE(ps.points, 0) AS points
     FROM predictions p
     LEFT JOIN prediction_scores ps ON ps.prediction_id = p.id
     WHERE p.ticket_id::text = $1`,
    [ticketId],
  );

  const predictionByMatch = new Map(
    predictionRows.map((row) => [
      Number(row.match_id),
      {
        id: row.id,
        score_casa: row.score_casa,
        score_visitante: row.score_visitante,
        submitted_at: row.submitted_at,
        updated_at: row.updated_at,
        points: Number(row.points ?? 0),
      },
    ]),
  );

  const items = context.scopeMatches
    .map((match) => matchEntryToScopeItem(match, predictionByMatch.get(Number(match.id))))
    .filter((item): item is AdminTicketPredictionItem => item != null);

  const predictionsCount = items.filter((item) => item.hasPrediction).length;
  const totalMatchesCount = items.length;

  return {
    items,
    totalMatchesCount,
    predictionsCount,
    pendingPredictionsCount: Math.max(totalMatchesCount - predictionsCount, 0),
  };
}

export async function assertMatchInAdminTicketScope(
  ticketId: string,
  matchId: number,
): Promise<AdminTicketScopeContext> {
  const context = await loadAdminTicketScopeContext(ticketId);
  if (!context) throw new Error("Cota não encontrada");
  const inScope = context.scopeMatches.some((match) => Number(match.id) === matchId);
  if (!inScope) throw new Error("Partida fora do escopo desta cota");
  return context;
}

export function adminTicketBolaoType(ticketType: string): "principal" | "diario" | "extra" {
  if (ticketType === "daily") return "diario";
  if (ticketType === "extra") return "extra";
  return "principal";
}
