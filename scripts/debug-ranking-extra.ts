/**
 * Debug ranking extra: compara cotas pagas vs quem entra no leaderboard.
 * Uso: npm run debug:ranking-extra -- <ticket_id_da_cota>
 */
import { config as dotenvConfig } from "dotenv";
import { getPool } from "../lib/db";
import { fetchMatchesMap, getMatchFromMap } from "../lib/football-api";
import { buildLeaderboardExtraForTicketDebug } from "../lib/ranking/leaderboard";
import { listMatchIdsForTicketPredictions, listPredictionsAggregateByBolao } from "../lib/predictions";

dotenvConfig({ path: ".env" });

const focusTicketId = process.argv[2]?.trim();
if (!focusTicketId) {
  console.error("Uso: npm run debug:ranking-extra -- <ticket_id>");
  process.exit(1);
}

async function main() {
  const pool = getPool();
  const { rows: ticketRows } = await pool.query<{
    id: string;
    user_id: string;
    extra_championship_id: number;
    round_number: number | null;
    status: string;
    is_promo_bonus: boolean;
  }>(
    `SELECT id::text, user_id::text, extra_championship_id, round_number, status::text,
            COALESCE(is_promo_bonus, false) AS is_promo_bonus
     FROM tickets WHERE id = $1`,
    [focusTicketId],
  );
  const focus = ticketRows[0];
  if (!focus) {
    console.error("Ticket não encontrado:", focusTicketId);
    process.exit(1);
  }
  console.log("\n=== Ticket foco ===");
  console.log(focus);

  const extraComp = focus.extra_championship_id;
  const { rows: paid } = await pool.query<{
    id: string;
    user_id: string;
    round_number: number | null;
    email: string;
    name: string | null;
  }>(
    `SELECT t.id::text, t.user_id::text, t.round_number, u.email, u.name
     FROM tickets t
     JOIN users u ON u.id::text = t.user_id::text
     WHERE t.status IN ('paid', 'approved')
       AND t.ticket_type = 'extra'
       AND t.extra_championship_id = $1
       AND NOT COALESCE(t.is_promo_bonus, false)
     ORDER BY t.created_at`,
    [extraComp],
  );

  const { rows: predCounts } = await pool.query<{
    ticket_id: string;
    pred_count: string;
    rodadas: string | null;
    datas: string | null;
  }>(
    `SELECT p.ticket_id::text,
            COUNT(*)::text AS pred_count,
            string_agg(DISTINCT mc.rodada::text, ', ' ORDER BY mc.rodada::text) AS rodadas,
            string_agg(DISTINCT mc.date_br, ', ' ORDER BY mc.date_br) AS datas
     FROM predictions p
     LEFT JOIN matches_cache mc
       ON mc.competition_id = $1 AND mc.match_id::text = p.match_id::text
     WHERE p.bolao_type = 'extra'
     GROUP BY p.ticket_id`,
    [extraComp],
  );
  const predByTicket = new Map(predCounts.map((r) => [r.ticket_id, r]));

  const matches = await fetchMatchesMap();
  const focusMatchIds = await listMatchIdsForTicketPredictions(focusTicketId);
  const allExtra = await listPredictionsAggregateByBolao("extra");

  console.log("\n=== Cotas pagas no campeonato", extraComp, "===", paid.length);
  for (const t of paid) {
    const pc = predByTicket.get(t.id);
    const predsOnComp = allExtra.filter((p) => p.ticket_id === t.id);
    const roundsFromMap = new Set<number>();
    const datesFromMap = new Set<string>();
    for (const p of predsOnComp) {
      const mi = getMatchFromMap(matches, extraComp, Number(p.match_id));
      if (mi?.rodada) roundsFromMap.add(mi.rodada);
      if (mi?.dateBR) datesFromMap.add(mi.dateBR);
    }
    console.log({
      ticket: t.id.slice(0, 8),
      user: t.name ?? t.email,
      round_number: t.round_number,
      palpites: pc?.pred_count ?? "0",
      rodadas_db: pc?.rodadas ?? "-",
      rodadas_map: [...roundsFromMap].join(",") || "-",
      datas_map: [...datesFromMap].join(",") || "-",
    });
  }

  console.log("\n=== Foco: match_ids com palpite ===", focusMatchIds.length);
  for (const mid of focusMatchIds.slice(0, 5)) {
    const mi = getMatchFromMap(matches, extraComp, mid);
    console.log(" ", mid, mi ? { rodada: mi.rodada, date: mi.dateBR, home: mi.home } : "SEM CACHE");
  }
  if (focusMatchIds.length > 5) console.log(" ...", focusMatchIds.length - 5, "mais");

  const { rows, meta } = await buildLeaderboardExtraForTicketDebug(focusTicketId);
  console.log("\n=== Leaderboard API (após fix rodada) ===");
  console.log("participantes:", meta.participantCount);
  console.log("linhas:", rows.length);
  for (const r of rows) {
    console.log(
      `#${r.pos}`.padEnd(4),
      r.displayName?.slice(0, 24).padEnd(26),
      `${r.outcomeCount} ac`.padEnd(8),
      `${r.totalPoints} pts`,
      r.ticketId.slice(0, 8),
    );
  }

  const inRanking = new Set(rows.map((r) => r.ticketId));
  const missing = paid.filter((t) => !inRanking.has(t.id));
  if (missing.length) {
    console.log("\n=== FORA do ranking (investigar) ===", missing.length);
    for (const t of missing) {
      const pc = predByTicket.get(t.id);
      console.log("-", t.name ?? t.email, {
        round_number: t.round_number,
        palpites: pc?.pred_count ?? "0",
        rodadas: pc?.rodadas,
      });
    }
  } else {
    console.log("\n✓ Todas as cotas pagas aparecem no ranking.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
