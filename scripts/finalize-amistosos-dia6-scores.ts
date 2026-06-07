/**
 * Finaliza os 5 jogos do Bolão dos Amistosos (06/06) com placares oficiais,
 * recomputa prediction_scores e exibe resumo do ranking extra.
 *
 * Mesma lógica do admin PATCH /api/admin/amistosos-matches, em lote.
 *
 * Uso:
 *   npm run amistosos:finalize
 *   npm run amistosos:finalize -- --dry-run
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env" });

import { getPool, ensureDatabasePoolReady } from "@/lib/db";
import {
  AMISTOSOS_FRIENDLY_MATCHES,
} from "@/lib/football/amistosos-friendlies";
import {
  finalizeAmistososFriendliesResults,
  type AmistososMatchResultInput,
} from "@/lib/football/amistosos-friendlies-finalize";
import {
  ensureAmistososFriendliesMatchesSeeded,
  listAmistososAdminMatches,
} from "@/lib/football/amistosos-friendlies-seed";
import { getLiveRankingTopByBolao } from "@/lib/predictions/scores-aggregate";

/** Placares finais — 06/06/2026 (dia dos amistosos). */
const OFFICIAL_RESULTS: AmistososMatchResultInput[] = [
  { matchId: 90606001, resultCasa: 2, resultVisitante: 1 }, // Portugal x Chile
  { matchId: 90606002, resultCasa: 1, resultVisitante: 2 }, // EUA x Alemanha
  { matchId: 90606003, resultCasa: 1, resultVisitante: 0 }, // Inglaterra x Nova Zelândia
  { matchId: 90606004, resultCasa: 2, resultVisitante: 1 }, // Brasil x Egito
  { matchId: 90606005, resultCasa: 2, resultVisitante: 0 }, // Argentina x Honduras
];

function labelForMatchId(matchId: number): string {
  const def = AMISTOSOS_FRIENDLY_MATCHES.find((m) => m.matchId === matchId);
  if (!def) return String(matchId);
  return `${def.homeName} x ${def.awayName} (${def.hourBr})`;
}

async function printMatchState(title: string) {
  const matches = await listAmistososAdminMatches();
  console.log(`\n${title}`);
  for (const m of matches) {
    const score =
      m.resultCasa != null && m.resultVisitante != null
        ? `${m.resultCasa} x ${m.resultVisitante}`
        : "—";
    console.log(
      `  ${m.hourBr}  ${m.homeName} x ${m.awayName}  →  ${score}  [${m.status}]`,
    );
  }
}

async function printPredictionStats(matchIds: number[]) {
  const pool = getPool();

  const stats = await pool.query<{
    predictions: string;
    scored_rows: string;
    total_points: string;
    exact_hits: string;
  }>(
    `SELECT
       COUNT(DISTINCT p.id)::text AS predictions,
       COUNT(ps.prediction_id)::text AS scored_rows,
       COALESCE(SUM(ps.points), 0)::text AS total_points,
       COALESCE(SUM(CASE WHEN ps.exact THEN 1 ELSE 0 END), 0)::text AS exact_hits
     FROM predictions p
     LEFT JOIN prediction_scores ps ON ps.prediction_id = p.id
     WHERE p.match_id = ANY($1::bigint[])
       AND p.bolao_type = 'extra'`,
    [matchIds],
  );

  const row = stats.rows[0];
  console.log("\nPontuação (bolão extra / amistosos):");
  console.log(`  Palpites: ${row?.predictions ?? "0"}`);
  console.log(`  Linhas em prediction_scores: ${row?.scored_rows ?? "0"}`);
  console.log(`  Pontos totais distribuídos: ${row?.total_points ?? "0"}`);
  console.log(`  Placares exatos: ${row?.exact_hits ?? "0"}`);
}

async function printTopRanking(limit = 15) {
  const top = await getLiveRankingTopByBolao("extra", { limit });
  if (top.length === 0) {
    console.log("\nRanking extra: nenhuma cota com pontos.");
    return;
  }

  const pool = getPool();
  const ids = top.map((t) => t.ticketId);
  const { rows } = await pool.query<{
    ticket_id: string;
    user_name: string | null;
    user_email: string;
  }>(
    `SELECT t.id::text AS ticket_id, u.name AS user_name, u.email AS user_email
     FROM tickets t
     INNER JOIN users u ON u.id = t.user_id
     WHERE t.id = ANY($1::uuid[])`,
    [ids],
  );
  const byTicket = new Map(rows.map((r) => [r.ticket_id, r]));

  console.log(`\nTop ${top.length} — ranking extra (amistosos):`);
  top.forEach((entry, index) => {
    const user = byTicket.get(entry.ticketId);
    const name = user?.user_name?.trim() || user?.user_email || entry.ticketId;
    console.log(
      `  ${String(index + 1).padStart(2, " ")}. ${name} — ${entry.totalPoints} pts` +
        ` (${entry.exactCount} exatos, ${entry.predictionsScored}/5 jogos pontuados)`,
    );
  });
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const t0 = Date.now();

  console.log("[amistosos:finalize] Bolão dos Amistosos — dia 06/06");
  if (dryRun) console.log("[amistosos:finalize] Modo dry-run — nada será gravado.");

  await ensureDatabasePoolReady();
  await ensureAmistososFriendliesMatchesSeeded();

  await printMatchState("Estado atual:");

  console.log("\nPlacares a aplicar:");
  for (const row of OFFICIAL_RESULTS) {
    console.log(
      `  ${labelForMatchId(row.matchId)} → ${row.resultCasa} x ${row.resultVisitante}`,
    );
  }

  if (dryRun) {
    console.log("\n[amistosos:finalize] Dry-run concluído.");
    await getPool().end().catch(() => {});
    return;
  }

  const result = await finalizeAmistososFriendliesResults(OFFICIAL_RESULTS);
  if (!result.ok) {
    console.error(`\n[amistosos:finalize] ERRO: ${result.error}`);
    await getPool().end().catch(() => {});
    process.exit(1);
  }

  console.log(
    `\n[amistosos:finalize] OK — ${result.matchIds.length} jogos finalizados, ` +
      `${result.predictionsUpdated} palpites recomputados em ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );

  await printMatchState("Estado após atualização:");
  await printPredictionStats(result.matchIds);
  await printTopRanking(15);

  await getPool().end().catch(() => {});
}

main().catch(async (err) => {
  console.error("[amistosos:finalize] FATAL:", err);
  await getPool().end().catch(() => {});
  process.exit(1);
});
