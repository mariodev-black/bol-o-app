import { getPool } from "@/lib/db";
import { getSoleConfiguredExtraChampionshipId } from "@/lib/boloes-extra-config";
import { inferBolaoTypeFromTicketId } from "@/lib/ticket-kind-server";
import { inferBolaoTypeFromTicketPrefix } from "@/lib/ticket-kind-shared";

function isUuidTicketId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

export async function resolveOwnedTicketMeta(
  userId: string,
  ticketId: string,
): Promise<{
  bolao: "principal" | "diario" | "extra";
  extraChampionshipId: number | null;
  extraRoundNumber: number | null;
} | null> {
  const raw = ticketId.trim();
  if (!raw) return null;

  const fromPrefix = inferBolaoTypeFromTicketPrefix(raw);
  if (fromPrefix && !isUuidTicketId(raw)) {
    return { bolao: fromPrefix, extraChampionshipId: null, extraRoundNumber: null };
  }

  if (isUuidTicketId(raw)) {
    const pool = getPool();
    const { rows } = await pool.query<{
      ticket_type: "general" | "daily" | "extra";
      extra_championship_id: number | null;
      round_number: number | null;
    }>(
      `SELECT ticket_type, extra_championship_id, round_number
       FROM tickets
       WHERE id::text = $1
         AND user_id = $2
         AND status = 'paid'
       LIMIT 1`,
      [raw, userId],
    );
    const tt = rows[0]?.ticket_type;
    if (tt === "general")
      return { bolao: "principal", extraChampionshipId: null, extraRoundNumber: null };
    if (tt === "daily")
      return { bolao: "diario", extraChampionshipId: null, extraRoundNumber: null };
    if (tt === "extra") {
      const rnumRaw = rows[0]?.round_number;
      const rnum =
        rnumRaw != null && Number.isFinite(Number(rnumRaw)) && Number(rnumRaw) > 0
          ? Number(rnumRaw)
          : null;
      const cid = rows[0]?.extra_championship_id;
      if (cid != null && Number.isFinite(Number(cid))) {
        return { bolao: "extra", extraChampionshipId: Number(cid), extraRoundNumber: rnum };
      }
      const sole = getSoleConfiguredExtraChampionshipId();
      if (sole != null) return { bolao: "extra", extraChampionshipId: sole, extraRoundNumber: rnum };
      return null;
    }
    return null;
  }

  const inferred = await inferBolaoTypeFromTicketId(raw);
  if (!inferred) return null;
  return { bolao: inferred, extraChampionshipId: null, extraRoundNumber: null };
}
