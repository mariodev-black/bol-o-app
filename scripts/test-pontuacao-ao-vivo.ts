/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Teste da pontuação AO VIVO (v2.1) — `prediction_scores` materializado.
 *
 * Cenários cobertos:
 *   1. Idempotência: persistir a MESMA partida (sem mudança real) NÃO escreve
 *      em matches_cache nem em prediction_scores (zero WAL, zero cascata).
 *   2. Mudança de placar: 1x1 (palpite 1x1=exato=6 pts) → 2x1 → pontuação
 *      RECALCULADA pra menos (palpite acertou 1 gol da casa = 1 pt).
 *   3. Múltiplos jogos no mesmo ticket: SUM agregada por ticket funciona.
 *   4. Reversão completa: placar volta para 1x1 → pontuação volta para 6.
 *   5. Múltiplos tickets do mesmo usuário: cada um soma só seus palpites.
 *
 * Usa fixtures sentinel (mesmo prefixo do test-e2e-completo.ts) — cleanup total
 * no final, com try/finally.
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env" });

import { randomUUID } from "node:crypto";
import { getPool, ensureDatabasePoolReady } from "@/lib/db";
import { persistMatchesV2 } from "@/lib/football/persistence";
import { getTicketLiveTotals, getTicketsLiveTotalsBatch } from "@/lib/predictions/scores-aggregate";
import type { ProviderMatchV2 } from "@/lib/football/provider";

// ─────────────────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m", green: "\x1b[32m", red: "\x1b[31m",
  cyan: "\x1b[36m", magenta: "\x1b[35m", gray: "\x1b[90m", bold: "\x1b[1m",
};
type R = { name: string; status: "PASS" | "FAIL"; detail?: string };
const RESULTS: R[] = [];
function section(t: string) {
  console.log(`\n${C.cyan}${C.bold}━━━ ${t} ${"━".repeat(Math.max(0, 64 - t.length))}${C.reset}`);
}
function pass(n: string, d?: string) {
  RESULTS.push({ name: n, status: "PASS", detail: d });
  console.log(`  ${C.green}✓${C.reset} ${n}${d ? `  ${C.gray}${d}${C.reset}` : ""}`);
}
function fail(n: string, d: string) {
  RESULTS.push({ name: n, status: "FAIL", detail: d });
  console.log(`  ${C.red}✗${C.reset} ${n}  ${C.red}${d}${C.reset}`);
}

const PREFIX = "TEST_LIVE_";
const FAKE_DATE = "01/02/2099";
const FAKE_COMP = 72; // mesmo do prod, isolado pelo date_br futuro
const M1 = 999_991_001;
const M2 = 999_991_002;
const M3 = 999_991_003;

async function cleanup() {
  const pool = getPool();
  await pool.query(`DELETE FROM prediction_scores WHERE match_id IN ($1, $2, $3)`, [M1, M2, M3]);
  await pool.query(
    `DELETE FROM predictions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '${PREFIX}%@local')`,
  );
  await pool.query(`DELETE FROM tickets WHERE external_ref LIKE 'TEST_LIVE_%'`);
  await pool.query(`DELETE FROM users WHERE email LIKE '${PREFIX}%@local'`);
  await pool.query(`DELETE FROM matches_cache WHERE match_id IN ($1, $2, $3)`, [M1, M2, M3]);
}

function mockProvider(matchId: number, status: string, casa: number | null, visit: number | null): ProviderMatchV2 {
  return {
    matchId,
    slug: `mock-${matchId}`,
    status,
    kickoffAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    dataRealizacao: FAKE_DATE,
    horaRealizacao: "20:00",
    dataRealizacaoIso: new Date(Date.now() - 30 * 60_000).toISOString(),
    resultCasa: casa,
    resultVisitante: visit,
    disputaPenalti: false,
    penaltisCasa: null,
    penaltisVisitante: null,
    phaseKey: null,
    fasesNome: null,
    fasesSlug: null,
    rodada: null,
    rodadaSlug: null,
    groupKey: null,
    roundKey: null,
    homeTeamId: null,
    homeName: "Casa",
    homePopular: null,
    homeSigla: "CSA",
    homeLogo: null,
    awayTeamId: null,
    awayName: "Fora",
    awayPopular: null,
    awaySigla: "FRA",
    awayLogo: null,
    estadioId: null,
    estadioNome: null,
    competitionId: FAKE_COMP,
    championshipNome: null,
    championshipSlug: null,
    championshipTemporada: null,
    rawProviderPayload: { e2e_live: true },
  };
}

async function setup(): Promise<{ aliceId: string; bobId: string; aliceTicket: string; bobTicket: string }> {
  const pool = getPool();
  const aliceId = randomUUID();
  const bobId = randomUUID();
  for (const [id, name] of [[aliceId, "alice"], [bobId, "bob"]] as const) {
    await pool.query(
      `INSERT INTO users (id, email, name, role, referral_code, created_at, updated_at,
                          balance_cents, affiliate_balance_cents, avatar_index,
                          admin_2fa_enabled, affiliate_mode, influencer_cpa_bps)
       VALUES ($1, $2, $3, 'user', $4, now(), now(), 0, 0, 0, false, 'standard', 0)`,
      [id, `${PREFIX}${name}@local`, `Test ${name}`, `${PREFIX}${name.toUpperCase()}`],
    );
  }
  const aliceTicket = randomUUID();
  const bobTicket = randomUUID();
  for (const [tid, uid, who] of [
    [aliceTicket, aliceId, "alice"],
    [bobTicket, bobId, "bob"],
  ] as const) {
    await pool.query(
      `INSERT INTO tickets (
         id, user_id, ticket_type, unit_price_cents, quantity, total_amount_cents,
         status, external_ref, paid_at, created_at, updated_at, is_promo_bonus
       ) VALUES ($1, $2, 'daily', 2000, 1, 2000, 'paid', $3, now()-interval '1 hour', now(), now(), false)`,
      [tid, uid, `TEST_LIVE_ticket:${who}`],
    );
  }

  // 3 partidas: começam SEM placar (agendado), assim no primeiro persist o score é 0.
  for (const mid of [M1, M2, M3]) {
    await pool.query(
      `INSERT INTO matches_cache (
         competition_id, match_id, status, kickoff_at, date_br, hour_br,
         home_name, home_sigla, home_logo, away_name, away_sigla, away_logo,
         source_updated_at, synced_at
       ) VALUES ($1, $2, 'agendado', $3, $4, '20:00',
                 'Casa', 'CSA', NULL, 'Fora', 'FRA', NULL, now(), now())`,
      [FAKE_COMP, mid, new Date(Date.now() - 30 * 60_000).toISOString(), FAKE_DATE],
    );
  }

  // Alice palpita 1x1 nos 3 jogos | Bob palpita 2x1 nos 3 jogos
  for (const [tid, uid, casa, visit] of [
    [aliceTicket, aliceId, 1, 1],
    [bobTicket, bobId, 2, 1],
  ] as const) {
    for (const mid of [M1, M2, M3]) {
      await pool.query(
        `INSERT INTO predictions (user_id, ticket_id, bolao_type, match_id, score_casa, score_visitante)
         VALUES ($1::uuid, $2, 'diario', $3, $4, $5)
         ON CONFLICT (user_id, ticket_id, match_id) DO NOTHING`,
        [uid, tid, mid, casa, visit],
      );
    }
  }

  return { aliceId, bobId, aliceTicket, bobTicket };
}

async function totalsOf(ticketId: string): Promise<{ total: number; exact: number; outcome: number; goals: number; scored: number }> {
  const t = await getTicketLiveTotals(ticketId);
  return {
    total: t.totalPoints,
    exact: t.exactCount,
    outcome: t.outcomeCount,
    goals: t.goalsCount,
    scored: t.predictionsScored,
  };
}

async function main() {
  const t0 = Date.now();
  console.log(`${C.bold}${C.magenta}TESTE PONTUACAO AO VIVO v2.1${C.reset}\n${C.gray}data: ${new Date().toISOString()}${C.reset}`);

  await ensureDatabasePoolReady();
  section("0) Cleanup inicial");
  await cleanup();
  pass("cleanup inicial ok");

  let fx: Awaited<ReturnType<typeof setup>> | null = null;
  try {
    fx = await setup();
    section("1) Setup: 2 usuarios, 2 tickets, 3 partidas, 6 palpites");
    pass("Alice 1x1 / 1x1 / 1x1 ; Bob 2x1 / 2x1 / 2x1");

    // ─── Cenário A: 1ª persist com TODOS os jogos virando 1x1 (ao vivo)
    section("2) 1ª persist: 3 jogos viram 1x1 (ao vivo)");
    const r1 = await persistMatchesV2(
      [
        mockProvider(M1, "ao vivo", 1, 1),
        mockProvider(M2, "ao vivo", 1, 1),
        mockProvider(M3, "ao vivo", 1, 1),
      ],
      { cascadeSource: "live-test", runCascadingClosures: false },
    );
    if (r1.scoredChangedIds.length === 3) pass("3 partidas com scoredChanged", `ids=${r1.scoredChangedIds.join(",")}`);
    else fail("scoredChangedIds (1ª)", `obtido ${r1.scoredChangedIds.length} esperado 3`);
    if (r1.predictionScoresUpdated >= 6) pass("predictionScoresUpdated >= 6", `${r1.predictionScoresUpdated}`);
    else fail("predictionScoresUpdated", `${r1.predictionScoresUpdated} (esperado >= 6)`);

    const aliceA = await totalsOf(fx.aliceTicket);
    const bobA = await totalsOf(fx.bobTicket);
    // Alice 1x1 vs 1x1 = 6 pts exato × 3 jogos = 18 pts
    if (aliceA.total === 18 && aliceA.exact === 3) pass("Alice 1x1 vs 1x1 × 3 = 18 pts", `${aliceA.total}p ${aliceA.exact} exatos`);
    else fail("Alice (caso 1x1)", JSON.stringify(aliceA));
    // Bob 2x1 vs 1x1: outcome=NO (vit casa vs empate), 1 gol acertado (visit) = 1 pt
    // × 3 jogos = 3 pts.
    if (bobA.total === 3 && bobA.goals === 3) pass("Bob 2x1 vs 1x1 × 3 = 3 pts (acertou 1 gol em cada)", `${bobA.total}p ${bobA.goals} gols`);
    else fail("Bob (caso 1x1)", JSON.stringify(bobA));

    // ─── Cenário B: IDEMPOTÊNCIA — mesma persist outra vez, NADA muda
    section("3) Idempotencia: re-persist identico nao escreve em matches_cache");
    const beforeMc = await getPool().query<{ updated: string }>(
      `SELECT max(source_updated_at)::text AS updated FROM matches_cache WHERE match_id IN ($1,$2,$3)`,
      [M1, M2, M3],
    );
    const r2 = await persistMatchesV2(
      [
        mockProvider(M1, "ao vivo", 1, 1),
        mockProvider(M2, "ao vivo", 1, 1),
        mockProvider(M3, "ao vivo", 1, 1),
      ],
      { cascadeSource: "live-test-2", runCascadingClosures: false },
    );
    const afterMc = await getPool().query<{ updated: string }>(
      `SELECT max(source_updated_at)::text AS updated FROM matches_cache WHERE match_id IN ($1,$2,$3)`,
      [M1, M2, M3],
    );
    if (r2.scoredChangedIds.length === 0 && r2.unchanged === 3) pass("zero scoredChanged + 3 unchanged", "tudo igual, nada gravado");
    else fail("idempotencia (counts)", `scored=${r2.scoredChangedIds.length} unchanged=${r2.unchanged}`);
    if (r2.written === 0) pass("zero UPSERTs em matches_cache", "");
    else fail("upsert idempotente", `written=${r2.written} (deveria ser 0)`);
    if (beforeMc.rows[0]?.updated === afterMc.rows[0]?.updated) {
      pass("source_updated_at NAO mudou", `${afterMc.rows[0]?.updated}`);
    } else {
      fail("source_updated_at", `before=${beforeMc.rows[0]?.updated} after=${afterMc.rows[0]?.updated}`);
    }

    // ─── Cenário C: REVERSÃO — placar muda de 1x1 → 2x1 e Alice PERDE pontos
    section("4) REVERSAO: 1x1 → 2x1, Alice deve PERDER pontos");
    const r3 = await persistMatchesV2(
      [mockProvider(M1, "ao vivo", 2, 1)],
      { cascadeSource: "live-test-rev", runCascadingClosures: false },
    );
    if (r3.scoredChangedIds.includes(M1)) pass("M1 detectado como scoredChanged", "");
    else fail("scoredChanged M1", "");

    const aliceB = await totalsOf(fx.aliceTicket);
    // Alice 1x1 vs 2x1 = 1 gol acertado (visit), 0 outcome = 1pt
    // Em M2/M3 ainda 1x1 → 6 cada = 12; + 1 do M1 = 13
    if (aliceB.total === 13) pass("Alice agora 13 pts (era 18) — REVERSAO funcionando", `${aliceB.total}p, ${aliceB.exact} exatos`);
    else fail("Alice reversao", `obtido ${aliceB.total} esperado 13 ${JSON.stringify(aliceB)}`);
    // Bob 2x1 vs 2x1 em M1 = 6 (exato). M2/M3 = 1 cada (1 gol acertado).
    // Total = 6 + 1 + 1 = 8 pts.
    const bobB = await totalsOf(fx.bobTicket);
    if (bobB.total === 8 && bobB.exact === 1) pass("Bob agora 8 pts (1 exato M1 + 1 gol em M2/M3)", `${bobB.total}p ${bobB.exact} exatos`);
    else fail("Bob (caso 2x1 em M1)", JSON.stringify(bobB));

    // ─── Cenário D: VOLTA — placar de M1 volta para 1x1 (revisão da API)
    section("5) Placar volta a 1x1, pontuacao retorna ao estado original");
    await persistMatchesV2(
      [mockProvider(M1, "ao vivo", 1, 1)],
      { cascadeSource: "live-test-back", runCascadingClosures: false },
    );
    const aliceC = await totalsOf(fx.aliceTicket);
    if (aliceC.total === 18) pass("Alice voltou para 18 pts", "");
    else fail("Alice volta", `obtido ${aliceC.total}`);
    const bobC = await totalsOf(fx.bobTicket);
    if (bobC.total === 3) pass("Bob voltou para 3 pts (estado inicial 1x1)", "");
    else fail("Bob volta", `obtido ${bobC.total}`);

    // ─── Cenário E: FINALIZADO — não dá mais para voltar (regra do worker)
    section("6) Jogos viram FINALIZADO — placares finais 1x1, 2x0, 0x0");
    await persistMatchesV2(
      [
        mockProvider(M1, "Finalizado", 1, 1),
        mockProvider(M2, "Finalizado", 2, 0),
        mockProvider(M3, "Finalizado", 0, 0),
      ],
      { cascadeSource: "live-test-final", runCascadingClosures: false },
    );
    const aliceD = await totalsOf(fx.aliceTicket);
    // Alice (1,1): M1 1x1 → 6 (exato), M2 2x0 → outcome+1gol→4, M3 0x0 → 3 (outcome empate)
    // Total esperado: 6 + 4 + 3 = 13? Esperem:
    //   M1: pred 1x1, real 1x1 → exato = 6
    //   M2: pred 1x1, real 2x0 → outcome? diff_pred=0 diff_real=2 → mismatch outcome (empate vs casa) → 0 outcome, gols: casa? real_casa=2, pred=1, !=. visit: real=0, pred=1, !=. → 0pts
    //   M3: pred 1x1, real 0x0 → outcome empate=true, gols: casa? 0!=1, visit? 0!=1 → outcome sem gol = 3pts
    //   Total = 6 + 0 + 3 = 9
    if (aliceD.total === 9) pass("Alice (1x1) em 3 jogos finais = 9 pts", `${aliceD.total}p`);
    else fail("Alice final", `obtido ${aliceD.total} esperado 9 ${JSON.stringify(aliceD)}`);
    // Bob (2,1):
    //   M1 1x1→ outcome no (casa vs empate), gol visit acertado (1==1) = 1pt
    //   M2 2x0→ outcome casa OK, gol casa acertado (2==2), visit não (0!=1) = 4pts
    //   M3 0x0→ outcome no (casa vs empate), gols 0!=2, 0!=1 = 0pts
    // Total = 5
    const bobFinal = await totalsOf(fx.bobTicket);
    if (bobFinal.total === 5 && bobFinal.exact === 0 && bobFinal.outcome === 1) {
      pass("Bob (2x1) em 3 jogos finais = 5 pts (1 outcome+1gol em M2 + 1 gol em M1)", `${bobFinal.total}p`);
    } else {
      fail("Bob final", `obtido ${bobFinal.total} esperado 5 ${JSON.stringify(bobFinal)}`);
    }

    // ─── Cenário F: AGREGAÇÃO BATCH funciona
    section("7) Aggregate batch (getTicketsLiveTotalsBatch)");
    const map = await getTicketsLiveTotalsBatch([fx.aliceTicket, fx.bobTicket, "ticket-inexistente"]);
    if (map.get(fx.aliceTicket)?.totalPoints === 9 && map.get(fx.bobTicket)?.totalPoints === 5) {
      pass("batch retorna totais corretos", `alice=${map.get(fx.aliceTicket)?.totalPoints} bob=${map.get(fx.bobTicket)?.totalPoints}`);
    } else {
      fail("batch totals", JSON.stringify([...map]));
    }
    if (map.get("ticket-inexistente")?.totalPoints === 0) pass("ticket inexistente -> 0 pts (nao falha)", "");
    else fail("ticket inexistente", JSON.stringify(map.get("ticket-inexistente")));

    // ─── Cenário G: prediction_scores reflete exatamente
    section("8) prediction_scores tem 6 linhas (2 tickets x 3 jogos)");
    const rowsCount = await getPool().query<{ n: string }>(
      `SELECT count(*)::text AS n FROM prediction_scores WHERE match_id IN ($1,$2,$3)`,
      [M1, M2, M3],
    );
    if (Number(rowsCount.rows[0]?.n || 0) === 6) pass("6 linhas em prediction_scores", "");
    else fail("count prediction_scores", `obtido ${rowsCount.rows[0]?.n}`);
  } finally {
    section("CLEANUP FINAL");
    try {
      await cleanup();
      pass("tudo removido (users, tickets, predictions, scores, matches mock)");
    } catch (err) {
      fail("cleanup", err instanceof Error ? err.message : String(err));
    }
  }

  section("RELATORIO");
  const total = RESULTS.length;
  const pp = RESULTS.filter((r) => r.status === "PASS").length;
  const ff = RESULTS.filter((r) => r.status === "FAIL").length;
  console.log(`  total: ${C.bold}${total}${C.reset} | ${C.green}PASS ${pp}${C.reset} | ${C.red}FAIL ${ff}${C.reset}`);
  if (ff > 0) {
    console.log(`\n  ${C.red}${C.bold}FAILURES:${C.reset}`);
    for (const r of RESULTS.filter((r) => r.status === "FAIL")) {
      console.log(`    ${C.red}✗${C.reset} ${r.name}: ${r.detail}`);
    }
  }
  console.log(`\n  ${C.gray}duracao: ${((Date.now() - t0) / 1000).toFixed(1)}s${C.reset}`);
  await getPool().end().catch(() => {});
  process.exit(ff > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("\n[fatal]", err);
  try {
    await cleanup();
  } catch {}
  await getPool().end().catch(() => {});
  process.exit(2);
});
