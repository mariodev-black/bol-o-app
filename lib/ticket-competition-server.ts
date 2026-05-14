import { getSoleConfiguredExtraChampionshipId } from "@/lib/boloes-extra-config";
import { getPool } from "@/lib/db";

/** `extra_championship_id` por ticket (só linhas `ticket_type = 'extra'`). */
export async function fetchExtraChampionshipIdByTicketIds(ticketIds: string[]): Promise<Map<string, number>> {
  const ids = [...new Set(ticketIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return new Map();
  const pool = getPool();
  const sole = getSoleConfiguredExtraChampionshipId();
  const { rows } = await pool.query<{ id: string; extra_championship_id: number | null }>(
    `SELECT id::text AS id,
            COALESCE(extra_championship_id, $2::int) AS extra_championship_id
     FROM tickets
     WHERE id::text = ANY($1::text[]) AND ticket_type = 'extra'`,
    [ids, sole]
  );
  const out = new Map<string, number>();
  for (const r of rows) {
    const c = r.extra_championship_id;
    if (c != null && Number.isFinite(Number(c)) && Number(c) > 0) out.set(String(r.id).trim(), Number(c));
  }
  return out;
}

/**
 * Preenche campeonato do bolão extra por ticket pago.
 * Se `extra_championship_id` no banco estiver nulo e existir **apenas** um id em `BOLOES_EXTRA_CHAMPIONSHIP_IDS`,
 * usa esse id (ex.: env só com `2`).
 */
export function mergeExtraChampionshipFromPaidTickets(
  map: Map<string, number>,
  tickets: ReadonlyArray<{ id: string; ticketType: string; extraChampionshipId?: number | null }>
): void {
  const sole = getSoleConfiguredExtraChampionshipId();
  for (const t of tickets) {
    if (t.ticketType !== "extra") continue;
    const tid = String(t.id).trim();
    let cid = Number(t.extraChampionshipId);
    if (!Number.isFinite(cid) || cid <= 0) cid = sole ?? 0;
    if (cid > 0) map.set(tid, cid);
  }
}

/** Campeonato da partida para somar pontos no ranking (mapa composto `competition_id:match_id`). */
export function matchCompetitionForRankingPrediction(
  prediction: { ticket_id: string; bolao_type: string },
  extraByTicketId: Map<string, number>,
  mainComp: number
): number | null {
  const tid = String(prediction.ticket_id ?? "").trim();
  const mapped = extraByTicketId.get(tid);
  if (mapped != null && Number.isFinite(mapped) && mapped > 0) return mapped;
  const bt = String(prediction.bolao_type ?? "").trim().toLowerCase();
  if (bt === "extra") return null;
  return mainComp;
}
