import {
  paidTicketExtraRoundNumber,
} from "@/lib/boloes/ticket-match-scope";
import {
  resolveEffectiveExtraRoundForTicket,
  type ExtraRoundResolution,
} from "@/lib/football/extras-rodada";
import { getPool } from "@/lib/db";

export type ExtraTicketRoundSource = {
  id: string;
  ticketType: "general" | "daily" | "extra";
  extraChampionshipId?: number | null;
  extraRoundNumber?: number | null;
};

/**
 * Rodada efetiva do bolão extra (API/cache), alinhada ao Brasileirão:
 * avança para a rodada atual quando a do ticket já encerrou.
 */
export async function resolveEffectiveRoundForExtraTicket(
  ticket: ExtraTicketRoundSource,
  opts?: {
    allowProviderCall?: boolean;
    userId?: string;
    /** Atualiza `tickets.round_number` quando a rodada efetiva avança. */
    persistAdvance?: boolean;
  },
): Promise<ExtraRoundResolution | null> {
  if (ticket.ticketType !== "extra") return null;
  const comp = Number(ticket.extraChampionshipId);
  if (!Number.isFinite(comp) || comp <= 0) return null;

  const fromDb = paidTicketExtraRoundNumber(ticket);
  const resolved = await resolveEffectiveExtraRoundForTicket(comp, fromDb, {
    allowProviderCall: opts?.allowProviderCall,
  });

  if (
    resolved &&
    opts?.persistAdvance !== false &&
    opts?.userId &&
    fromDb != null &&
    resolved.rodada > fromDb
  ) {
    await getPool()
      .query(
        `UPDATE tickets SET round_number = $1
           WHERE id::text = $2 AND user_id = $3 AND ticket_type = 'extra'`,
        [resolved.rodada, ticket.id, opts.userId],
      )
      .catch(() => {});
  }

  return resolved;
}

export function effectiveRoundNumberFromResolution(
  resolved: ExtraRoundResolution | null,
  ticket: ExtraTicketRoundSource,
): number | null {
  if (resolved?.rodada != null && resolved.rodada > 0) return resolved.rodada;
  return paidTicketExtraRoundNumber(ticket);
}
