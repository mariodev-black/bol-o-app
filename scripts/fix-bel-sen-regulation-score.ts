/**
 * Corrige placar aos 90 min — Bélgica x Senegal (Chave 8) — e repontua todos os palpites.
 *
 * O bolão pontua só o tempo regulamentar. Se a API gravou 3x2 (prorrogação),
 * este script ajusta para o placar correto aos 90 min e recomputa prediction_scores.
 *
 * Uso:
 *   npm run match:fix-bel-sen -- --dry-run
 *   npm run match:fix-bel-sen -- 1 1
 *   npm run match:fix-bel-sen -- --match-id 123456 --casa 1 --visitante 1
 */
import "dotenv/config";
import { getPool } from "@/lib/db";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import {
  applyRegulationMatchResultAndRecompute,
  previewRegulationMatchRepontuation,
} from "@/lib/admin/regulation-match-result-update";

const DEFAULT_MATCH_ID = 32338;
const DEFAULT_RESULT_CASA = 2;
const DEFAULT_RESULT_VISITANTE = 2;

type CliArgs = {
  dryRun: boolean;
  matchId: number | null;
  resultCasa: number;
  resultVisitante: number;
  phaseKey: string;
};

function parseArgs(argv: string[]): CliArgs {
  const dryRun = argv.includes("--dry-run");
  let matchId: number | null = DEFAULT_MATCH_ID;
  let resultCasa = DEFAULT_RESULT_CASA;
  let resultVisitante = DEFAULT_RESULT_VISITANTE;
  let phaseKey = "CHAVE-8";

  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--dry-run") continue;
    if (arg === "--match-id") {
      matchId = Number(argv[++i]);
      continue;
    }
    if (arg === "--casa") {
      resultCasa = Number(argv[++i]);
      continue;
    }
    if (arg === "--visitante") {
      resultVisitante = Number(argv[++i]);
      continue;
    }
    if (arg === "--phase") {
      phaseKey = String(argv[++i] ?? "").trim().toUpperCase();
      if (!phaseKey.startsWith("CHAVE-")) phaseKey = `CHAVE-${phaseKey}`;
      continue;
    }
    positional.push(arg);
  }

  if (positional[0] != null) resultCasa = Number(positional[0]);
  if (positional[1] != null) resultVisitante = Number(positional[1]);

  return { dryRun, matchId, resultCasa, resultVisitante, phaseKey };
}

async function resolveBelgiumSenegalMatchId(
  pool: ReturnType<typeof getPool>,
  compId: number,
  phaseKey: string,
): Promise<{
  match_id: number;
  home_name: string;
  away_name: string;
  home_sigla: string | null;
  away_sigla: string | null;
  phase_key: string | null;
  status: string;
  result_casa: number | null;
  result_visitante: number | null;
  kickoff_at: string | null;
}> {
  const { rows } = await pool.query(
    `SELECT match_id::text, home_name, away_name, home_sigla, away_sigla, phase_key,
            status, result_casa, result_visitante, kickoff_at::text
     FROM matches_cache
     WHERE competition_id = $1
       AND (
         (home_sigla = 'BEL' AND away_sigla = 'SEN')
         OR (home_sigla = 'SEN' AND away_sigla = 'BEL')
         OR (home_name ILIKE '%belg%' AND away_name ILIKE '%sene%')
         OR (home_name ILIKE '%sene%' AND away_name ILIKE '%belg%')
       )
       AND ($2::text = '' OR phase_key = $2 OR phase_key ILIKE '%segunda%')
     ORDER BY kickoff_at DESC NULLS LAST
     LIMIT 5`,
    [compId, phaseKey],
  );

  if (rows.length === 0) {
    throw new Error(
      `Partida Bélgica x Senegal não encontrada (comp=${compId}, phase=${phaseKey})`,
    );
  }

  const belHome = rows.find(
    (r) =>
      String(r.home_sigla ?? "").toUpperCase() === "BEL" ||
      /belg/i.test(String(r.home_name ?? "")),
  );
  const pick = belHome ?? rows[0]!;
  return {
    match_id: Number(pick.match_id),
    home_name: String(pick.home_name),
    away_name: String(pick.away_name),
    home_sigla: pick.home_sigla,
    away_sigla: pick.away_sigla,
    phase_key: pick.phase_key,
    status: String(pick.status),
    result_casa: pick.result_casa,
    result_visitante: pick.result_visitante,
    kickoff_at: pick.kickoff_at,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!Number.isFinite(args.resultCasa) || !Number.isFinite(args.resultVisitante)) {
    console.error(
      "Uso: npm run match:fix-bel-sen -- [--dry-run] [--match-id N] [--casa N] [--visitante N] [casa visitante]",
    );
    process.exit(1);
  }

  const pool = getPool();
  const compId = getFootballMainCompetitionId();
  const client = await pool.connect();

  try {
    const match =
      args.matchId != null && Number.isFinite(args.matchId) && args.matchId > 0
        ? (
            await pool.query(
              `SELECT match_id::text, home_name, away_name, home_sigla, away_sigla, phase_key,
                      status, result_casa, result_visitante, kickoff_at::text
               FROM matches_cache
               WHERE competition_id = $1 AND match_id = $2
               LIMIT 1`,
              [compId, args.matchId],
            )
          ).rows[0]
        : await resolveBelgiumSenegalMatchId(pool, compId, args.phaseKey);

    if (!match) throw new Error(`Match ${args.matchId} não encontrado`);

    const matchId = Number(match.match_id);
    console.log("=== Bélgica x Senegal — correção placar 90 min ===");
    console.log({
      match_id: matchId,
      jogo: `${match.home_name} x ${match.away_name}`,
      phase_key: match.phase_key,
      kickoff_at: match.kickoff_at,
      status_atual: match.status,
      placar_atual: `${match.result_casa ?? "-"}x${match.result_visitante ?? "-"}`,
      placar_novo_90min: `${args.resultCasa}x${args.resultVisitante}`,
      dry_run: args.dryRun,
    });

    const preview = await previewRegulationMatchRepontuation(client, {
      matchId,
      resultCasa: args.resultCasa,
      resultVisitante: args.resultVisitante,
    });

    const preds = await pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM predictions WHERE match_id = $1`,
      [matchId],
    );
    console.log(`\nPalpites na partida: ${preds.rows[0]?.total ?? 0}`);
    console.log(`Mudanças de pontuação (amostra até 25):`);

    const changed = preview.filter((r) => r.delta !== 0);
    const sample = (changed.length > 0 ? changed : preview).slice(0, 25);
    for (const row of sample) {
      console.log({
        email: row.user_email,
        palpite: `${row.score_casa}x${row.score_visitante}`,
        pontos_antes: row.old_points ?? 0,
        pontos_depois: row.new_points,
        delta: row.delta,
      });
    }

    const totalDelta = preview.reduce((sum, r) => sum + r.delta, 0);
    console.log("\nResumo repontuação:", {
      palpites: preview.length,
      com_mudanca: changed.length,
      delta_total_pontos: totalDelta,
    });

    if (args.dryRun) {
      console.log("\n[dry-run] Nenhuma alteração gravada.");
      return;
    }

    const result = await applyRegulationMatchResultAndRecompute({
      matchId,
      resultCasa: args.resultCasa,
      resultVisitante: args.resultVisitante,
    });

    console.log("\n✓ Atualizado com sucesso:", {
      competition_ids: result.competitionIdsUpdated,
      prediction_scores_atualizados: result.predictionsUpdated,
      placar_final: `${result.resultCasa}x${result.resultVisitante}`,
    });
    console.log(
      "Ranking e totais ao vivo passam a refletir os novos pontos na próxima leitura.",
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
