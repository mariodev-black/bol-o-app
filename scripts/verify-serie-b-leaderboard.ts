import "dotenv/config";
import { getPool } from "@/lib/db";
import { fetchMatchesMapDirectFromDb } from "@/lib/football-api";
import { getMatchFromMap } from "@/lib/match-map-types";
import { calcPredictionPoints } from "@/lib/predictions/calc-points";

const COMP = 14;
const RODADA = 12;

async function main() {
  const pool = getPool();
  const matches = await fetchMatchesMapDirectFromDb();

  const roundMatches = await pool.query<{ match_id: string }>(
    `SELECT match_id::text FROM matches_cache WHERE competition_id = $1 AND rodada = $2`,
    [COMP, RODADA],
  );
  const roundMatchIds = new Set(roundMatches.rows.map((r) => Number(r.match_id)));

  const preds = await pool.query<{
    ticket_id: string;
    match_id: string;
    score_casa: number;
    score_visitante: number;
  }>(
    `SELECT p.ticket_id, p.match_id::text, p.score_casa, p.score_visitante
     FROM predictions p
     JOIN tickets t ON t.id::text = p.ticket_id
     WHERE t.extra_championship_id = $1 AND t.status = 'paid' AND t.round_number = $2`,
    [COMP, RODADA],
  );

  const byTicket = new Map<string, number>();
  let scoredPreds = 0;
  for (const p of preds.rows) {
    const mid = Number(p.match_id);
    if (!roundMatchIds.has(mid)) continue;
    const m = getMatchFromMap(matches, COMP, mid);
    if (!m || m.resultCasa == null || m.resultVisitante == null) continue;
    scoredPreds++;
    const pts = calcPredictionPoints(
      p.score_casa,
      p.score_visitante,
      m.resultCasa,
      m.resultVisitante,
    ).points;
    byTicket.set(p.ticket_id, (byTicket.get(p.ticket_id) ?? 0) + pts);
  }

  const sorted = [...byTicket.entries()]
    .map(([ticketId, totalPoints]) => ({ ticketId, totalPoints }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  console.log("round match ids:", roundMatchIds.size);
  console.log("preds in round:", preds.rows.length);
  console.log("preds with results:", scoredPreds);
  console.log("tickets with points:", sorted.filter((t) => t.totalPoints > 0).length);
  console.log("top 5:");
  console.table(sorted.slice(0, 5));

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
