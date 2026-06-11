import { getPool } from "@/lib/db";
import type { ArtilheiroPickSlot } from "@/lib/artilheiros/config";
import { findArtilheiroPlayer, isValidArtilheiroPlayer } from "@/lib/artilheiros/elencos";
import type { ArtilheiroPickRow } from "@/lib/artilheiros/types";

type PickDbRow = {
  slot: number;
  api_player_id: number;
  api_team_id: number;
  player_name: string;
  team_name: string;
  team_logo: string | null;
  player_photo: string | null;
  player_position: string | null;
  player_number: number | null;
  player_age: number | null;
  locked_at: Date;
};

function mapPickRow(r: PickDbRow): ArtilheiroPickRow {
  return {
    slot: r.slot as ArtilheiroPickSlot,
    apiPlayerId: r.api_player_id,
    apiTeamId: r.api_team_id,
    playerName: r.player_name,
    teamName: r.team_name,
    teamLogo: r.team_logo,
    playerPhoto: r.player_photo,
    playerPosition: r.player_position,
    playerNumber: r.player_number,
    playerAge: r.player_age,
    lockedAt: r.locked_at.toISOString(),
  };
}

export async function assertOwnedArtilheirosTicket(
  userId: string,
  ticketId: string,
): Promise<void> {
  const pool = getPool();
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM tickets
     WHERE id = $1 AND user_id = $2 AND ticket_type = 'artilheiros' AND status = 'paid'
     LIMIT 1`,
    [ticketId, userId],
  );
  if (!rows[0]) {
    throw new Error("Cota de artilheiros nao encontrada ou nao paga");
  }
}

export async function listArtilheiroPicksForTicket(ticketId: string): Promise<ArtilheiroPickRow[]> {
  const pool = getPool();
  const { rows } = await pool.query<PickDbRow>(
    `SELECT slot, api_player_id, api_team_id, player_name, team_name, team_logo,
            player_photo, player_position, player_number, player_age, locked_at
     FROM artilheiro_picks
     WHERE ticket_id = $1
     ORDER BY slot ASC`,
    [ticketId],
  );
  return rows.map(mapPickRow);
}

export async function getArtilheiroPickForSlot(
  ticketId: string,
  slot: ArtilheiroPickSlot,
): Promise<ArtilheiroPickRow | null> {
  const pool = getPool();
  const { rows } = await pool.query<PickDbRow>(
    `SELECT slot, api_player_id, api_team_id, player_name, team_name, team_logo,
            player_photo, player_position, player_number, player_age, locked_at
     FROM artilheiro_picks
     WHERE ticket_id = $1 AND slot = $2
     LIMIT 1`,
    [ticketId, slot],
  );
  return rows[0] ? mapPickRow(rows[0]) : null;
}

export async function saveArtilheiroPick(input: {
  userId: string;
  ticketId: string;
  slot: ArtilheiroPickSlot;
  apiPlayerId: number;
  apiTeamId: number;
}): Promise<ArtilheiroPickRow> {
  await assertOwnedArtilheirosTicket(input.userId, input.ticketId);

  const existing = await getArtilheiroPickForSlot(input.ticketId, input.slot);
  if (existing) {
    throw new Error("Este palpite ja foi confirmado e nao pode ser alterado");
  }

  if (!isValidArtilheiroPlayer(input.apiPlayerId, input.apiTeamId)) {
    throw new Error("Jogador invalido para esta selecao");
  }

  const player = findArtilheiroPlayer(input.apiPlayerId)!;

  const pool = getPool();
  const dup = await pool.query(
    `SELECT 1 FROM artilheiro_picks WHERE ticket_id = $1 AND api_player_id = $2 LIMIT 1`,
    [input.ticketId, input.apiPlayerId],
  );
  if (dup.rows.length > 0) {
    throw new Error("Este jogador ja foi escolhido nesta cota");
  }

  const { rows } = await pool.query<PickDbRow>(
    `INSERT INTO artilheiro_picks (
       user_id, ticket_id, slot, api_player_id, api_team_id,
       player_name, team_name, team_logo, player_photo, player_position, player_number, player_age
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING slot, api_player_id, api_team_id, player_name, team_name, team_logo,
               player_photo, player_position, player_number, player_age, locked_at`,
    [
      input.userId,
      input.ticketId,
      input.slot,
      player.apiPlayerId,
      player.apiTeamId,
      player.nome,
      player.teamDisplayNome,
      player.teamLogo,
      player.foto,
      player.posicao,
      player.numero,
      player.idade,
    ],
  );
  return mapPickRow(rows[0]!);
}

export async function saveArtilheiroPicksBatch(input: {
  userId: string;
  ticketId: string;
  picks: Array<{
    slot: ArtilheiroPickSlot;
    apiPlayerId: number;
    apiTeamId: number;
  }>;
}): Promise<ArtilheiroPickRow[]> {
  await assertOwnedArtilheirosTicket(input.userId, input.ticketId);

  if (input.picks.length === 0) {
    throw new Error("Nenhum palpite informado");
  }

  const existing = await listArtilheiroPicksForTicket(input.ticketId);
  if (existing.length >= 3) {
    throw new Error("Palpites ja confirmados");
  }

  const existingSlots = new Set(existing.map((p) => p.slot));
  const incomingSlots = new Set<number>();
  for (const p of input.picks) {
    if (existingSlots.has(p.slot)) {
      throw new Error("Este palpite ja foi confirmado e nao pode ser alterado");
    }
    if (incomingSlots.has(p.slot)) {
      throw new Error("Slots duplicados no envio");
    }
    incomingSlots.add(p.slot);
  }

  if (existing.length + input.picks.length > 3) {
    throw new Error("Quantidade invalida de palpites");
  }

  const usedPlayerIds = new Set(existing.map((p) => p.apiPlayerId));
  for (const p of input.picks) {
    if (!isValidArtilheiroPlayer(p.apiPlayerId, p.apiTeamId)) {
      throw new Error("Jogador invalido para esta selecao");
    }
    if (usedPlayerIds.has(p.apiPlayerId)) {
      throw new Error("Este jogador ja foi escolhido nesta cota");
    }
    usedPlayerIds.add(p.apiPlayerId);
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const p of input.picks) {
      const player = findArtilheiroPlayer(p.apiPlayerId)!;
      await client.query(
        `INSERT INTO artilheiro_picks (
           user_id, ticket_id, slot, api_player_id, api_team_id,
           player_name, team_name, team_logo, player_photo, player_position, player_number, player_age
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          input.userId,
          input.ticketId,
          p.slot,
          player.apiPlayerId,
          player.apiTeamId,
          player.nome,
          player.teamDisplayNome,
          player.teamLogo,
          player.foto,
          player.posicao,
          player.numero,
          player.idade,
        ],
      );
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  return listArtilheiroPicksForTicket(input.ticketId);
}

export function artilheiroPicksComplete(picks: ArtilheiroPickRow[]): boolean {
  return picks.length >= 3;
}
