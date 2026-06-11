import { getPool } from "@/lib/db";
import type { ArtilheiroPickSlot } from "@/lib/artilheiros/config";
import { findArtilheiroPlayer, isValidArtilheiroPlayer } from "@/lib/artilheiros/elencos";
import { calcArtilheiroScore } from "@/lib/artilheiros/scoring";
import { listArtilheiroPicksForTicket } from "@/lib/artilheiros/picks";
import type { ArtilheiroOfficialResultRow } from "@/lib/artilheiros/types";

type ResultDbRow = {
  slot: number;
  api_player_id: number;
  api_team_id: number;
  player_name: string;
  team_name: string;
  team_logo: string | null;
  player_photo: string | null;
  goals: number;
  applied_at: Date | null;
};

function mapResultRow(r: ResultDbRow): ArtilheiroOfficialResultRow {
  return {
    slot: r.slot as ArtilheiroPickSlot,
    apiPlayerId: r.api_player_id,
    apiTeamId: r.api_team_id,
    playerName: r.player_name,
    teamName: r.team_name,
    teamLogo: r.team_logo,
    playerPhoto: r.player_photo,
    goals: r.goals,
    appliedAt: r.applied_at ? r.applied_at.toISOString() : null,
  };
}

export async function listArtilheiroOfficialResults(): Promise<ArtilheiroOfficialResultRow[]> {
  const pool = getPool();
  const { rows } = await pool.query<ResultDbRow>(
    `SELECT slot, api_player_id, api_team_id, player_name, team_name, team_logo,
            player_photo, goals, applied_at
     FROM artilheiro_official_results
     ORDER BY slot ASC`,
  );
  return rows.map(mapResultRow);
}

export function isArtilheiroResultApplied(results: ArtilheiroOfficialResultRow[]): boolean {
  return results.length === 3 && results.every((r) => r.appliedAt != null);
}

export async function upsertArtilheiroOfficialDraft(input: {
  slot: ArtilheiroPickSlot;
  apiPlayerId: number;
  apiTeamId: number;
  goals?: number;
}): Promise<void> {
  if (!isValidArtilheiroPlayer(input.apiPlayerId, input.apiTeamId)) {
    throw new Error(`Jogador invalido no slot ${input.slot}`);
  }
  const player = findArtilheiroPlayer(input.apiPlayerId)!;
  const pool = getPool();
  await pool.query(
    `INSERT INTO artilheiro_official_results (
       slot, api_player_id, api_team_id, player_name, team_name, team_logo, player_photo, goals
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (slot) DO UPDATE SET
       api_player_id = EXCLUDED.api_player_id,
       api_team_id = EXCLUDED.api_team_id,
       player_name = EXCLUDED.player_name,
       team_name = EXCLUDED.team_name,
       team_logo = EXCLUDED.team_logo,
       player_photo = EXCLUDED.player_photo,
       goals = EXCLUDED.goals,
       updated_at = now()`,
    [
      input.slot,
      player.apiPlayerId,
      player.apiTeamId,
      player.nome,
      player.teamDisplayNome,
      player.teamLogo,
      player.foto,
      Math.max(0, Math.trunc(input.goals ?? 0)),
    ],
  );
}

export async function applyArtilheiroOfficialResults(adminUserId: string): Promise<{
  ticketsScored: number;
}> {
  const pool = getPool();
  const draft = await listArtilheiroOfficialResults();
  if (draft.length < 3) {
    throw new Error("Defina os 3 artilheiros oficiais antes de aplicar");
  }

  const playerIds = draft.map((r) => r.apiPlayerId);
  if (new Set(playerIds).size !== 3) {
    throw new Error("Os 3 artilheiros devem ser jogadores diferentes");
  }

  await pool.query(
    `UPDATE artilheiro_official_results
     SET applied_at = now(), applied_by = $1, updated_at = now()
     WHERE applied_at IS NULL OR applied_at IS NOT NULL`,
    [adminUserId],
  );

  const { rows: tickets } = await pool.query<{ id: string; user_id: string }>(
    `SELECT t.id::text AS id, t.user_id::text AS user_id
     FROM tickets t
     WHERE t.ticket_type = 'artilheiros' AND t.status = 'paid'`,
  );

  const official = await listArtilheiroOfficialResults();
  let scored = 0;

  for (const ticket of tickets) {
    const picks = await listArtilheiroPicksForTicket(ticket.id);
    if (picks.length < 3) continue;
    const breakdown = calcArtilheiroScore(picks, official);
    await pool.query(
      `INSERT INTO artilheiro_ticket_scores (
         ticket_id, user_id, position_points, bonus_points, total_points, updated_at
       ) VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (ticket_id) DO UPDATE SET
         position_points = EXCLUDED.position_points,
         bonus_points = EXCLUDED.bonus_points,
         total_points = EXCLUDED.total_points,
         updated_at = now()`,
      [
        ticket.id,
        ticket.user_id,
        breakdown.positionPoints,
        breakdown.bonusPoints,
        breakdown.totalPoints,
      ],
    );
    scored += 1;
  }

  return { ticketsScored: scored };
}
