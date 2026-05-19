/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Teste FULL DE PRÉ-DEPLOY — cobre TODAS as modalidades de bolão ponta a ponta.
 *
 * Cobre, EM ORDEM:
 *   1. Setup multi-modalidade: 6 usuários, tickets geral/diário/extra,
 *      múltiplos jogos em modalidades diferentes.
 *   2. Modalidade GERAL: ciclo completo (agendado → ao vivo → reversão → final),
 *      validação de prediction_scores e ranking ao vivo.
 *   3. Modalidade DIÁRIA: ciclo completo + processClosure + premiação + idempotência.
 *   4. Modalidade EXTRA POR RODADA: tickets com `round_number`, validação de
 *      isolamento entre rodadas (jogos da rodada 99 não contaminam rodada 100).
 *   5. CRUZADO: usuário com tickets em modalidades diferentes; cada SUM
 *      por ticket retorna somente seus palpites.
 *   6. ANTI-CASCATA: re-persist sem mudança → ZERO writes, ZERO recompute.
 *   7. WORKER REALTIME: SQL não inclui partidas finalizadas (regra crítica).
 *   8. CLEANUP TOTAL.
 *
 * Identificadores sentinel:
 *   - email:        TEST_PROD_<slug>@local
 *   - external_ref: TEST_PROD_ticket:*
 *   - match_id:     999_960_xxx (geral), 999_970_xxx (diário), 999_980_xxx (extra)
 *   - date_br:      "01/01/2099" (geral/diário), "01/02/2099" (extra)
 *
 * Roda contra o Postgres REAL. Sem chamar API Futebol.
 *
 * Uso:
 *   npm run test:prod
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env" });

import { randomUUID } from "node:crypto";
import { calcPredictionPoints, upsertPrediction } from "@/lib/predictions";
import { persistMatchesV2 } from "@/lib/football/persistence";
import { processPrizeClosuresAfterMatchSync } from "@/lib/prizes/processor";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { getPool, ensureDatabasePoolReady } from "@/lib/db";
import {
  getTicketLiveTotals,
  getTicketsLiveTotalsBatch,
  getLiveRankingTopByBolao,
} from "@/lib/predictions/scores-aggregate";
import type { ProviderMatchV2 } from "@/lib/football/provider";

// ─────────────────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m", green: "\x1b[32m", red: "\x1b[31m",
  yellow: "\x1b[33m", cyan: "\x1b[36m", magenta: "\x1b[35m",
  gray: "\x1b[90m", bold: "\x1b[1m",
};
type R = { name: string; status: "PASS" | "FAIL"; detail?: string };
const RESULTS: R[] = [];
function section(t: string) {
  console.log(`\n${C.cyan}${C.bold}━━━ ${t} ${"━".repeat(Math.max(0, 70 - t.length))}${C.reset}`);
}
function pass(n: string, d?: string) {
  RESULTS.push({ name: n, status: "PASS", detail: d });
  console.log(`  ${C.green}✓${C.reset} ${n}${d ? `  ${C.gray}${d}${C.reset}` : ""}`);
}
function fail(n: string, d: string) {
  RESULTS.push({ name: n, status: "FAIL", detail: d });
  console.log(`  ${C.red}✗${C.reset} ${n}  ${C.red}${d}${C.reset}`);
}
function info(m: string) {
  console.log(`    ${C.gray}${m}${C.reset}`);
}

// ─────────────────────────────────────────────────────────────────────
// Constantes sentinel
// ─────────────────────────────────────────────────────────────────────
const PREFIX = "TEST_PROD_";
const FAKE_DATE_GERAL_DIARIO = "01/01/2099";
const FAKE_DATE_EXTRA = "01/02/2099";
const COMP_PRINCIPAL = getFootballMainCompetitionId(); // 72 (Copa)
const COMP_EXTRA = 10; // Brasileirão (existe nos BOLOES_EXTRA_CHAMPIONSHIP_IDS)
const ROUND_NUMBER_FOCUS = 99;
const ROUND_NUMBER_OTHER = 100; // pra testar isolamento

const M_GERAL_BASE = 999_960_000;
const M_DIARIO_BASE = 999_970_000;
const M_EXTRA_BASE = 999_980_000;

// ─────────────────────────────────────────────────────────────────────
async function cleanup(): Promise<void> {
  const pool = getPool();
  await pool.query(
    `DELETE FROM prediction_scores
     WHERE match_id >= 999900000
        OR ticket_id IN (
             SELECT id::text FROM tickets WHERE external_ref LIKE 'TEST_PROD_%'
           )`,
  );
  await pool.query(
    `DELETE FROM transactions
     WHERE external_ref LIKE 'TEST_PROD_%'
        OR (external_ref LIKE 'internal_prize:%' AND user_id IN (
              SELECT id FROM users WHERE email LIKE '${PREFIX}%@local'
            ))`,
  );
  await pool.query(
    `DELETE FROM prize_awards WHERE user_id IN (SELECT id FROM users WHERE email LIKE '${PREFIX}%@local')`,
  );
  await pool.query(
    `DELETE FROM prize_closures WHERE date_br IN ($1, $2)`,
    [FAKE_DATE_GERAL_DIARIO, FAKE_DATE_EXTRA],
  );
  await pool.query(
    `DELETE FROM predictions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '${PREFIX}%@local')`,
  );
  await pool.query(`DELETE FROM tickets WHERE external_ref LIKE 'TEST_PROD_%'`);
  await pool.query(`DELETE FROM users WHERE email LIKE '${PREFIX}%@local'`);
  await pool.query(
    `DELETE FROM matches_cache
     WHERE match_id BETWEEN $1 AND $2
        OR date_br IN ($3, $4)`,
    [999_900_000, 999_999_999, FAKE_DATE_GERAL_DIARIO, FAKE_DATE_EXTRA],
  );
}

// ─────────────────────────────────────────────────────────────────────
function buildMockMatch(opts: {
  competitionId: number;
  matchId: number;
  status: string;
  casa: number | null;
  visit: number | null;
  kickoffMinFromNow: number;
  dateBR: string;
  rodada?: number | null;
}): ProviderMatchV2 {
  const kickoff = new Date(Date.now() + opts.kickoffMinFromNow * 60_000);
  return {
    matchId: opts.matchId,
    slug: `mock-${opts.matchId}`,
    status: opts.status,
    kickoffAt: kickoff.toISOString(),
    dataRealizacao: opts.dateBR,
    horaRealizacao: "20:00",
    dataRealizacaoIso: kickoff.toISOString(),
    resultCasa: opts.casa,
    resultVisitante: opts.visit,
    disputaPenalti: false,
    penaltisCasa: null,
    penaltisVisitante: null,
    phaseKey: null,
    fasesNome: null,
    fasesSlug: null,
    rodada: opts.rodada ?? null,
    rodadaSlug: opts.rodada != null ? `rodada-${opts.rodada}` : null,
    groupKey: null,
    roundKey: null,
    homeTeamId: null,
    homeName: `Casa-${opts.matchId % 1000}`,
    homePopular: null,
    homeSigla: "CSA",
    homeLogo: null,
    awayTeamId: null,
    awayName: `Fora-${opts.matchId % 1000}`,
    awayPopular: null,
    awaySigla: "FRA",
    awayLogo: null,
    estadioId: null,
    estadioNome: null,
    competitionId: opts.competitionId,
    championshipNome: null,
    championshipSlug: null,
    championshipTemporada: null,
    rawProviderPayload: { test_prod: true },
  };
}

// ─────────────────────────────────────────────────────────────────────
type SetupResult = {
  users: {
    alice: string;   // ticket geral + ticket diario + ticket extra(rodada99)
    bob: string;     // ticket geral + ticket diario
    carol: string;   // ticket diario + ticket extra(rodada99)
    daniel: string;  // ticket extra(rodada99) + ticket extra(rodada100) <- isolamento
    edu: string;     // ticket geral só
    fran: string;    // ticket diario só
  };
  tickets: {
    geralAlice: string; geralBob: string; geralEdu: string;
    diarioAlice: string; diarioBob: string; diarioCarol: string; diarioFran: string;
    extraR99Alice: string; extraR99Carol: string; extraR99Daniel: string;
    extraR100Daniel: string;
  };
  matches: {
    geral: number[];      // 3 partidas
    diario: number[];     // 3 partidas
    extraR99: number[];   // 2 partidas (rodada 99)
    extraR100: number[];  // 1 partida  (rodada 100)
  };
};

async function setup(): Promise<SetupResult> {
  const pool = getPool();
  section("1) Setup multi-modalidade: usuarios, tickets, partidas");

  const users: Record<string, string> = {};
  for (const name of ["alice", "bob", "carol", "daniel", "edu", "fran"]) {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO users (id, email, name, role, referral_code, created_at, updated_at,
                          balance_cents, affiliate_balance_cents, avatar_index,
                          admin_2fa_enabled, affiliate_mode, influencer_cpa_bps)
       VALUES ($1, $2, $3, 'user', $4, now(), now(), 0, 0, 0, false, 'standard', 0)`,
      [id, `${PREFIX}${name}@local`, `Prod ${name}`, `${PREFIX}${name.toUpperCase()}`],
    );
    users[name] = id;
  }
  pass("criou 6 usuarios", "alice/bob/carol/daniel/edu/fran");

  // tickets geral: alice, bob, edu (R$ 39,90)
  const tickets: Record<string, string> = {};
  for (const [k, uid, ref] of [
    ["geralAlice", users.alice, "geral:alice"],
    ["geralBob", users.bob, "geral:bob"],
    ["geralEdu", users.edu, "geral:edu"],
  ] as const) {
    const tid = randomUUID();
    await pool.query(
      `INSERT INTO tickets (id, user_id, ticket_type, unit_price_cents, quantity, total_amount_cents,
                            status, external_ref, paid_at, created_at, updated_at, is_promo_bonus)
       VALUES ($1, $2, 'general', 3990, 1, 3990, 'paid', $3, now()-interval '2 hours', now(), now(), false)`,
      [tid, uid, `TEST_PROD_ticket:${ref}`],
    );
    tickets[k] = tid;
  }
  pass("3 tickets GERAL (R$ 39,90 cada)", "alice, bob, edu");

  // tickets diario (R$ 20)
  for (const [k, uid, ref] of [
    ["diarioAlice", users.alice, "diario:alice"],
    ["diarioBob", users.bob, "diario:bob"],
    ["diarioCarol", users.carol, "diario:carol"],
    ["diarioFran", users.fran, "diario:fran"],
  ] as const) {
    const tid = randomUUID();
    await pool.query(
      `INSERT INTO tickets (id, user_id, ticket_type, unit_price_cents, quantity, total_amount_cents,
                            status, external_ref, paid_at, created_at, updated_at, is_promo_bonus)
       VALUES ($1, $2, 'daily', 2000, 1, 2000, 'paid', $3, now()-interval '2 hours', now(), now(), false)`,
      [tid, uid, `TEST_PROD_ticket:${ref}`],
    );
    tickets[k] = tid;
  }
  pass("4 tickets DIARIO (R$ 20,00 cada)", "alice, bob, carol, fran");

  // tickets EXTRA — comp 10, rodada 99 (3 usuarios)
  for (const [k, uid, ref] of [
    ["extraR99Alice", users.alice, "extra:r99:alice"],
    ["extraR99Carol", users.carol, "extra:r99:carol"],
    ["extraR99Daniel", users.daniel, "extra:r99:daniel"],
  ] as const) {
    const tid = randomUUID();
    await pool.query(
      `INSERT INTO tickets (id, user_id, ticket_type, unit_price_cents, quantity, total_amount_cents,
                            status, external_ref, paid_at, created_at, updated_at, is_promo_bonus,
                            extra_championship_id, round_number)
       VALUES ($1, $2, 'extra', 1500, 1, 1500, 'paid', $3, now()-interval '2 hours', now(), now(), false,
               $4, $5)`,
      [tid, uid, `TEST_PROD_ticket:${ref}`, COMP_EXTRA, ROUND_NUMBER_FOCUS],
    );
    tickets[k] = tid;
  }
  pass("3 tickets EXTRA rodada 99 (R$ 15,00 cada)", "alice, carol, daniel");

  // ticket EXTRA rodada 100 (Daniel) — para validar isolamento
  {
    const tid = randomUUID();
    await pool.query(
      `INSERT INTO tickets (id, user_id, ticket_type, unit_price_cents, quantity, total_amount_cents,
                            status, external_ref, paid_at, created_at, updated_at, is_promo_bonus,
                            extra_championship_id, round_number)
       VALUES ($1, $2, 'extra', 1500, 1, 1500, 'paid', $3, now()-interval '2 hours', now(), now(), false,
               $4, $5)`,
      [tid, users.daniel, `TEST_PROD_ticket:extra:r100:daniel`, COMP_EXTRA, ROUND_NUMBER_OTHER],
    );
    tickets["extraR100Daniel"] = tid;
  }
  pass("1 ticket EXTRA rodada 100 (Daniel)", "para validar isolamento entre rodadas");

  // ─── matches mock ───────────────────────────────────────────────
  const matches: SetupResult["matches"] = {
    geral: [M_GERAL_BASE + 1, M_GERAL_BASE + 2, M_GERAL_BASE + 3],
    diario: [M_DIARIO_BASE + 1, M_DIARIO_BASE + 2, M_DIARIO_BASE + 3],
    extraR99: [M_EXTRA_BASE + 1, M_EXTRA_BASE + 2],
    extraR100: [M_EXTRA_BASE + 50],
  };
  const kickoffFuture = new Date(Date.now() + 120 * 60_000); // +2h (longe do lock)
  for (const mid of matches.geral) {
    await pool.query(
      `INSERT INTO matches_cache (competition_id, match_id, status, kickoff_at, date_br, hour_br,
                                  home_name, home_sigla, away_name, away_sigla,
                                  source_updated_at, synced_at)
       VALUES ($1, $2, 'agendado', $3, $4, '20:00', 'CasaG', 'CSA', 'ForaG', 'FRA', now(), now())`,
      [COMP_PRINCIPAL, mid, kickoffFuture.toISOString(), FAKE_DATE_GERAL_DIARIO],
    );
  }
  for (const mid of matches.diario) {
    await pool.query(
      `INSERT INTO matches_cache (competition_id, match_id, status, kickoff_at, date_br, hour_br,
                                  home_name, home_sigla, away_name, away_sigla,
                                  source_updated_at, synced_at)
       VALUES ($1, $2, 'agendado', $3, $4, '21:00', 'CasaD', 'CSA', 'ForaD', 'FRA', now(), now())`,
      [COMP_PRINCIPAL, mid, kickoffFuture.toISOString(), FAKE_DATE_GERAL_DIARIO],
    );
  }
  for (const mid of matches.extraR99) {
    await pool.query(
      `INSERT INTO matches_cache (competition_id, match_id, status, kickoff_at, date_br, hour_br,
                                  home_name, home_sigla, away_name, away_sigla,
                                  rodada, rodada_slug,
                                  source_updated_at, synced_at)
       VALUES ($1, $2, 'agendado', $3, $4, '19:00', 'CasaE', 'CSA', 'ForaE', 'FRA',
               $5, '99a-rodada', now(), now())`,
      [COMP_EXTRA, mid, kickoffFuture.toISOString(), FAKE_DATE_EXTRA, ROUND_NUMBER_FOCUS],
    );
  }
  for (const mid of matches.extraR100) {
    await pool.query(
      `INSERT INTO matches_cache (competition_id, match_id, status, kickoff_at, date_br, hour_br,
                                  home_name, home_sigla, away_name, away_sigla,
                                  rodada, rodada_slug,
                                  source_updated_at, synced_at)
       VALUES ($1, $2, 'agendado', $3, $4, '19:00', 'CasaE2', 'CSA', 'ForaE2', 'FRA',
               $5, '100a-rodada', now(), now())`,
      [COMP_EXTRA, mid, kickoffFuture.toISOString(), FAKE_DATE_EXTRA, ROUND_NUMBER_OTHER],
    );
  }
  pass(
    `criou ${matches.geral.length + matches.diario.length + matches.extraR99.length + matches.extraR100.length} partidas mock`,
    `geral=${matches.geral.length}, diario=${matches.diario.length}, extraR99=${matches.extraR99.length}, extraR100=${matches.extraR100.length}`,
  );

  return {
    users: users as SetupResult["users"],
    tickets: tickets as SetupResult["tickets"],
    matches,
  };
}

// ─────────────────────────────────────────────────────────────────────
async function createAllPredictions(fx: SetupResult) {
  section("2) Palpites: 6 usuarios em 3 modalidades");
  const palpites: Array<{ uid: string; tid: string; bolao: "principal" | "diario" | "extra"; m: number; c: number; v: number; who: string }> = [
    // ─── GERAL — 3 partidas (G1, G2, G3): planejados como real 2x0 / 3x2 / 1x1
    // Alice: exato em tudo → 6+6+6 = 18
    { uid: fx.users.alice, tid: fx.tickets.geralAlice, bolao: "principal", m: fx.matches.geral[0]!, c: 2, v: 0, who: "alice/geral G1" },
    { uid: fx.users.alice, tid: fx.tickets.geralAlice, bolao: "principal", m: fx.matches.geral[1]!, c: 3, v: 2, who: "alice/geral G2" },
    { uid: fx.users.alice, tid: fx.tickets.geralAlice, bolao: "principal", m: fx.matches.geral[2]!, c: 1, v: 1, who: "alice/geral G3" },
    // Bob: outcome+1gol em G1 (=4), outcome em G2 (=3), exato em G3 (=6) → 13
    { uid: fx.users.bob, tid: fx.tickets.geralBob, bolao: "principal", m: fx.matches.geral[0]!, c: 1, v: 0, who: "bob/geral G1" },
    { uid: fx.users.bob, tid: fx.tickets.geralBob, bolao: "principal", m: fx.matches.geral[1]!, c: 4, v: 1, who: "bob/geral G2" },
    { uid: fx.users.bob, tid: fx.tickets.geralBob, bolao: "principal", m: fx.matches.geral[2]!, c: 1, v: 1, who: "bob/geral G3" },
    // Edu: errado total
    { uid: fx.users.edu, tid: fx.tickets.geralEdu, bolao: "principal", m: fx.matches.geral[0]!, c: 0, v: 3, who: "edu/geral G1" },
    { uid: fx.users.edu, tid: fx.tickets.geralEdu, bolao: "principal", m: fx.matches.geral[1]!, c: 0, v: 5, who: "edu/geral G2" },
    { uid: fx.users.edu, tid: fx.tickets.geralEdu, bolao: "principal", m: fx.matches.geral[2]!, c: 5, v: 0, who: "edu/geral G3" },

    // ─── DIARIO — 3 partidas (D1, D2, D3): planejados como real 1x0 / 2x2 / 0x1
    // Alice: exato em D1 (=6), outcome em D2 (=3), errado D3 (=0) → 9
    { uid: fx.users.alice, tid: fx.tickets.diarioAlice, bolao: "diario", m: fx.matches.diario[0]!, c: 1, v: 0, who: "alice/diario D1" },
    { uid: fx.users.alice, tid: fx.tickets.diarioAlice, bolao: "diario", m: fx.matches.diario[1]!, c: 3, v: 3, who: "alice/diario D2" },
    { uid: fx.users.alice, tid: fx.tickets.diarioAlice, bolao: "diario", m: fx.matches.diario[2]!, c: 2, v: 0, who: "alice/diario D3" },
    // Bob: errado D1 (=0), exato D2 (=6), exato D3 (=6) → 12
    { uid: fx.users.bob, tid: fx.tickets.diarioBob, bolao: "diario", m: fx.matches.diario[0]!, c: 0, v: 2, who: "bob/diario D1" },
    { uid: fx.users.bob, tid: fx.tickets.diarioBob, bolao: "diario", m: fx.matches.diario[1]!, c: 2, v: 2, who: "bob/diario D2" },
    { uid: fx.users.bob, tid: fx.tickets.diarioBob, bolao: "diario", m: fx.matches.diario[2]!, c: 0, v: 1, who: "bob/diario D3" },
    // Carol: tudo errado (0)
    { uid: fx.users.carol, tid: fx.tickets.diarioCarol, bolao: "diario", m: fx.matches.diario[0]!, c: 5, v: 5, who: "carol/diario D1" },
    { uid: fx.users.carol, tid: fx.tickets.diarioCarol, bolao: "diario", m: fx.matches.diario[1]!, c: 0, v: 0, who: "carol/diario D2" },
    { uid: fx.users.carol, tid: fx.tickets.diarioCarol, bolao: "diario", m: fx.matches.diario[2]!, c: 5, v: 0, who: "carol/diario D3" },
    // Fran: outcome empate em D2 (=3) → total 3
    { uid: fx.users.fran, tid: fx.tickets.diarioFran, bolao: "diario", m: fx.matches.diario[0]!, c: 3, v: 3, who: "fran/diario D1" },
    { uid: fx.users.fran, tid: fx.tickets.diarioFran, bolao: "diario", m: fx.matches.diario[1]!, c: 1, v: 1, who: "fran/diario D2" },
    { uid: fx.users.fran, tid: fx.tickets.diarioFran, bolao: "diario", m: fx.matches.diario[2]!, c: 4, v: 4, who: "fran/diario D3" },

    // ─── EXTRA R99 — 2 partidas (E1, E2): planejados como real 0x0 / 2x1
    // Alice: outcome empate sem gols D1 (=3), outcome+1gol E2 (=4) → 7
    { uid: fx.users.alice, tid: fx.tickets.extraR99Alice, bolao: "extra", m: fx.matches.extraR99[0]!, c: 1, v: 1, who: "alice/extra E1" },
    { uid: fx.users.alice, tid: fx.tickets.extraR99Alice, bolao: "extra", m: fx.matches.extraR99[1]!, c: 2, v: 0, who: "alice/extra E2" },
    // Carol: exato em E1 (=6), errado E2 (=0) → 6
    { uid: fx.users.carol, tid: fx.tickets.extraR99Carol, bolao: "extra", m: fx.matches.extraR99[0]!, c: 0, v: 0, who: "carol/extra E1" },
    { uid: fx.users.carol, tid: fx.tickets.extraR99Carol, bolao: "extra", m: fx.matches.extraR99[1]!, c: 0, v: 3, who: "carol/extra E2" },
    // Daniel: exato em E2 (=6), errado E1 (=0) → 6
    { uid: fx.users.daniel, tid: fx.tickets.extraR99Daniel, bolao: "extra", m: fx.matches.extraR99[0]!, c: 2, v: 1, who: "daniel/extra E1" },
    { uid: fx.users.daniel, tid: fx.tickets.extraR99Daniel, bolao: "extra", m: fx.matches.extraR99[1]!, c: 2, v: 1, who: "daniel/extra E2" },

    // ─── EXTRA R100 — 1 partida (E_OTHER): jogo da rodada 100, NÃO deve cruzar com R99
    { uid: fx.users.daniel, tid: fx.tickets.extraR100Daniel, bolao: "extra", m: fx.matches.extraR100[0]!, c: 1, v: 1, who: "daniel/extra E_OTHER" },
  ];

  for (const p of palpites) {
    try {
      await upsertPrediction({
        userId: p.uid,
        ticketId: p.tid,
        bolaoType: p.bolao,
        matchId: p.m,
        scoreCasa: p.c,
        scoreVisitante: p.v,
      });
    } catch (err) {
      fail(`upsertPrediction ${p.who}`, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }
  pass(`${palpites.length} palpites criados`, "6 usuários x 3 modalidades");
}

// ─────────────────────────────────────────────────────────────────────
async function testFormulaPontuacao() {
  section("3) Formula calcPredictionPoints — sanity check");
  const cases = [
    { pred: [2, 0], real: [2, 0], expected: 6, label: "exato vit casa" },
    { pred: [1, 0], real: [2, 0], expected: 4, label: "outcome casa + 1 gol (visit=0=0)" },
    { pred: [4, 1], real: [3, 2], expected: 3, label: "outcome casa sem gol exato" },
    { pred: [2, 2], real: [1, 1], expected: 3, label: "outcome empate sem gol exato" },
    { pred: [1, 0], real: [1, 2], expected: 1, label: "errou outcome, acertou 1 gol casa" },
    { pred: [0, 3], real: [2, 0], expected: 0, label: "errou tudo" },
  ];
  for (const c of cases) {
    const r = calcPredictionPoints(c.pred[0]!, c.pred[1]!, c.real[0]!, c.real[1]!);
    if (r.points === c.expected) pass(`${c.label}: pred ${c.pred[0]}x${c.pred[1]} vs real ${c.real[0]}x${c.real[1]} = ${c.expected}`);
    else fail(`${c.label}`, `obtido ${r.points} esperado ${c.expected}`);
  }
}

// ─────────────────────────────────────────────────────────────────────
async function testGeralLifecycle(fx: SetupResult) {
  section("4) GERAL: ciclo agendado → ao vivo → reversao → finalizado");
  // Step 1: G1 vira ao vivo 1x0
  await persistMatchesV2(
    [
      buildMockMatch({ competitionId: COMP_PRINCIPAL, matchId: fx.matches.geral[0]!, status: "ao vivo", casa: 1, visit: 0, kickoffMinFromNow: -30, dateBR: FAKE_DATE_GERAL_DIARIO }),
    ],
    { cascadeSource: "prod-test-geral-1", runCascadingClosures: false },
  );
  let aliceT = await getTicketLiveTotals(fx.tickets.geralAlice);
  // Alice pred (2,0) vs real (1,0): outcome casa OK, gol visit acertado (0=0) = 4 pts
  if (aliceT.totalPoints === 4) pass("Alice G1=1x0 ao vivo: 4 pts (outcome+1gol)", "");
  else fail("Alice G1 ao vivo", `obtido ${aliceT.totalPoints}`);

  // Step 2: G1 vira 2x0 (Alice agora exato → ganha pontos)
  await persistMatchesV2(
    [buildMockMatch({ competitionId: COMP_PRINCIPAL, matchId: fx.matches.geral[0]!, status: "ao vivo", casa: 2, visit: 0, kickoffMinFromNow: -30, dateBR: FAKE_DATE_GERAL_DIARIO })],
    { cascadeSource: "prod-test-geral-2", runCascadingClosures: false },
  );
  aliceT = await getTicketLiveTotals(fx.tickets.geralAlice);
  if (aliceT.totalPoints === 6 && aliceT.exactCount === 1) pass("Alice G1=2x0: passou para 6 pts (exato)", "ganhou pontos");
  else fail("Alice G1 2x0", `obtido ${JSON.stringify(aliceT)}`);

  // Step 3: REVERSÃO — G1 muda para 2x1 (Alice perde exato; pontuação cai)
  await persistMatchesV2(
    [buildMockMatch({ competitionId: COMP_PRINCIPAL, matchId: fx.matches.geral[0]!, status: "ao vivo", casa: 2, visit: 1, kickoffMinFromNow: -30, dateBR: FAKE_DATE_GERAL_DIARIO })],
    { cascadeSource: "prod-test-geral-3", runCascadingClosures: false },
  );
  aliceT = await getTicketLiveTotals(fx.tickets.geralAlice);
  // Alice (2,0) vs (2,1): outcome casa OK, gol casa 2=2 OK = 4 pts
  if (aliceT.totalPoints === 4) pass("Alice G1=2x1 REVERSAO: 4 pts (perdeu 2 do exato → outcome+1gol)", "pontos caíram");
  else fail("Alice reversao G1", `obtido ${aliceT.totalPoints}`);

  // Step 4: finaliza tudo com placares planejados (G1 2x0, G2 3x2, G3 1x1)
  await persistMatchesV2(
    [
      buildMockMatch({ competitionId: COMP_PRINCIPAL, matchId: fx.matches.geral[0]!, status: "Finalizado", casa: 2, visit: 0, kickoffMinFromNow: -120, dateBR: FAKE_DATE_GERAL_DIARIO }),
      buildMockMatch({ competitionId: COMP_PRINCIPAL, matchId: fx.matches.geral[1]!, status: "Finalizado", casa: 3, visit: 2, kickoffMinFromNow: -110, dateBR: FAKE_DATE_GERAL_DIARIO }),
      buildMockMatch({ competitionId: COMP_PRINCIPAL, matchId: fx.matches.geral[2]!, status: "Finalizado", casa: 1, visit: 1, kickoffMinFromNow: -100, dateBR: FAKE_DATE_GERAL_DIARIO }),
    ],
    { cascadeSource: "prod-test-geral-final", runCascadingClosures: false },
  );
  const totals = await getTicketsLiveTotalsBatch([
    fx.tickets.geralAlice, fx.tickets.geralBob, fx.tickets.geralEdu,
  ]);
  const alice = totals.get(fx.tickets.geralAlice)!;
  const bob = totals.get(fx.tickets.geralBob)!;
  const edu = totals.get(fx.tickets.geralEdu)!;
  if (alice.totalPoints === 18 && alice.exactCount === 3) pass("Alice GERAL final: 18 pts (3 exatos)", "");
  else fail("Alice GERAL final", JSON.stringify(alice));
  if (bob.totalPoints === 13) pass("Bob GERAL final: 13 pts", JSON.stringify(bob));
  else fail("Bob GERAL final", `obtido ${bob.totalPoints} esperado 13 ${JSON.stringify(bob)}`);
  if (edu.totalPoints === 0) pass("Edu GERAL final: 0 pts (errou tudo)");
  else fail("Edu GERAL final", JSON.stringify(edu));

  // Ranking ao vivo do bolão principal: ordenação correta
  const rankPrincipal = await getLiveRankingTopByBolao("principal", { limit: 10 });
  // pode ter outros tickets antigos no DB; filtramos só os nossos
  const ranking = rankPrincipal.filter((r) => [fx.tickets.geralAlice, fx.tickets.geralBob, fx.tickets.geralEdu].includes(r.ticketId));
  if (ranking.length === 3 && ranking[0]?.ticketId === fx.tickets.geralAlice && ranking[1]?.ticketId === fx.tickets.geralBob && ranking[2]?.ticketId === fx.tickets.geralEdu) {
    pass("ranking principal ordenado: alice > bob > edu", `${ranking.map((r) => r.totalPoints).join(' > ')}`);
  } else {
    fail("ranking principal", `ordem incorreta: ${ranking.map((r) => `${r.ticketId.slice(0,6)}=${r.totalPoints}`).join(", ")}`);
  }
}

// ─────────────────────────────────────────────────────────────────────
async function testDiarioLifecycle(fx: SetupResult) {
  section("5) DIARIO: ciclo + fechamento + premiacao + idempotencia");
  const pool = getPool();
  // Finaliza tudo (D1 1x0, D2 2x2, D3 0x1)
  await persistMatchesV2(
    [
      buildMockMatch({ competitionId: COMP_PRINCIPAL, matchId: fx.matches.diario[0]!, status: "Finalizado", casa: 1, visit: 0, kickoffMinFromNow: -360, dateBR: FAKE_DATE_GERAL_DIARIO }),
      buildMockMatch({ competitionId: COMP_PRINCIPAL, matchId: fx.matches.diario[1]!, status: "Finalizado", casa: 2, visit: 2, kickoffMinFromNow: -350, dateBR: FAKE_DATE_GERAL_DIARIO }),
      buildMockMatch({ competitionId: COMP_PRINCIPAL, matchId: fx.matches.diario[2]!, status: "Finalizado", casa: 0, visit: 1, kickoffMinFromNow: -340, dateBR: FAKE_DATE_GERAL_DIARIO }),
    ],
    { cascadeSource: "prod-test-diario", runCascadingClosures: false },
  );
  // Forçar TODOS os jogos com date_br do diário com kickoff > grace (180 min default).
  // Como o `processClosure(daily)` agrupa TODA partida com a mesma date_br dentro da comp,
  // precisamos garantir que tanto os 3 jogos do GERAL quanto os 3 do DIARIO (todos comp 72)
  // que compartilham FAKE_DATE_GERAL_DIARIO já passaram do grace.
  await pool.query(
    `UPDATE matches_cache SET kickoff_at = now() - interval '6 hours'
     WHERE date_br = $1 AND competition_id = $2`,
    [FAKE_DATE_GERAL_DIARIO, COMP_PRINCIPAL],
  );

  // Validar pontos por ticket ANTES do closure (já vem materializado em prediction_scores)
  const totals = await getTicketsLiveTotalsBatch([
    fx.tickets.diarioAlice, fx.tickets.diarioBob, fx.tickets.diarioCarol, fx.tickets.diarioFran,
  ]);
  const tAlice = totals.get(fx.tickets.diarioAlice)!;
  const tBob = totals.get(fx.tickets.diarioBob)!;
  const tCarol = totals.get(fx.tickets.diarioCarol)!;
  const tFran = totals.get(fx.tickets.diarioFran)!;
  // Esperados:
  //   Alice D1 (1,0)vs(1,0)=6  D2 (3,3)vs(2,2)=3 (outcome empate sem gol)  D3 (2,0)vs(0,1)=0 → 9
  //   Bob   D1 (0,2)vs(1,0)=0 (errou outcome, sem gol)  D2 (2,2)vs(2,2)=6  D3 (0,1)vs(0,1)=6 → 12
  //   Carol todos errados → 0
  //   Fran D2 (1,1)vs(2,2)=3 outcome empate; D1/D3 errado total → 3
  if (tAlice.totalPoints === 9) pass("Alice DIARIO=9 pts (1 exato em D1)", "");
  else fail("Alice DIARIO", `obtido ${tAlice.totalPoints} ${JSON.stringify(tAlice)}`);
  if (tBob.totalPoints === 12) pass("Bob DIARIO=12 pts (2 exatos)", "");
  else fail("Bob DIARIO", `obtido ${tBob.totalPoints} ${JSON.stringify(tBob)}`);
  // Carol D2: pred (0,0) vs real (2,2) → outcome empate sem gol exato = 3 pts
  // D1 e D3 errados = 0. Total: 3.
  if (tCarol.totalPoints === 3 && tCarol.outcomeCount === 1) pass("Carol DIARIO=3 pts (outcome empate em D2)", "");
  else fail("Carol DIARIO", JSON.stringify(tCarol));
  if (tFran.totalPoints === 3) pass("Fran DIARIO=3 pts (D2 outcome empate)", "");
  else fail("Fran DIARIO", `obtido ${tFran.totalPoints} ${JSON.stringify(tFran)}`);

  // Saldos antes
  const balBefore = await pool.query<{ name: string; balance_cents: number }>(
    `SELECT name, balance_cents FROM users WHERE email LIKE '${PREFIX}%@local' ORDER BY name`,
  );
  // Limpar closures pré-existentes desse date_br
  await pool.query(`DELETE FROM prize_closures WHERE date_br=$1`, [FAKE_DATE_GERAL_DIARIO]);

  await processPrizeClosuresAfterMatchSync({ source: "prod-test-diario-close" });

  const cl = await pool.query<{
    id: string; total_revenue_cents: number; pool_cents: number; closure_key: string;
  }>(`SELECT id, total_revenue_cents, pool_cents, closure_key FROM prize_closures WHERE date_br=$1`, [FAKE_DATE_GERAL_DIARIO]);
  if (cl.rows.length !== 1) {
    fail("prize_closures unico", `${cl.rows.length} linhas`);
    return;
  }
  const closure = cl.rows[0]!;
  // Receita esperada: 4 tickets diary × R$ 20 = R$ 80 = 8000 cents
  if (closure.total_revenue_cents === 8000) pass("receita closure DIARIO = 8000 cents (4 × R$ 20)");
  else fail("receita closure DIARIO", `obtido ${closure.total_revenue_cents}`);
  // Pool 60% = 4800
  if (closure.pool_cents === 4800) pass("pool closure DIARIO = 4800 (60%)");
  else fail("pool closure DIARIO", `obtido ${closure.pool_cents}`);

  // Awards: Bob é #1 (12 pts), Alice #2 (9 pts, 1 exato), Fran #3 (3 pts), Carol #4 (0)
  const awards = await pool.query<{ rank_position: number; ticket_id: string; total_points: number; amount_cents: number }>(
    `SELECT rank_position, ticket_id, total_points, amount_cents
     FROM prize_awards WHERE closure_id=$1 ORDER BY rank_position`,
    [closure.id],
  );
  if (awards.rows.length >= 3) pass(`awards: ${awards.rows.length} colocacoes`);
  else fail("awards count", `só ${awards.rows.length} colocações`);
  for (const a of awards.rows) info(`#${a.rank_position} ticket ${a.ticket_id.slice(0,8)}… ${a.total_points}p → R$ ${(a.amount_cents/100).toFixed(2)}`);

  const first = awards.rows[0]!;
  if (first.ticket_id === fx.tickets.diarioBob && first.total_points === 12) pass("1º DIARIO = Bob (12 pts)");
  else fail("1º DIARIO", `obtido ticket=${first.ticket_id.slice(0,8)} ${first.total_points}p`);
  const second = awards.rows[1]!;
  if (second.ticket_id === fx.tickets.diarioAlice && second.total_points === 9) pass("2º DIARIO = Alice (9 pts)");
  else fail("2º DIARIO", `obtido ticket=${second.ticket_id.slice(0,8)} ${second.total_points}p`);

  // Saldo do Bob cresceu
  const balAfter = await pool.query<{ name: string; balance_cents: number }>(
    `SELECT name, balance_cents FROM users WHERE email LIKE '${PREFIX}%@local' ORDER BY name`,
  );
  const bobBefore = balBefore.rows.find((u) => u.name === "Prod bob")?.balance_cents ?? 0;
  const bobAfter = balAfter.rows.find((u) => u.name === "Prod bob")?.balance_cents ?? 0;
  if (bobAfter > bobBefore) pass("saldo Bob cresceu apos premiacao", `+R$ ${((bobAfter - bobBefore) / 100).toFixed(2)}`);
  else fail("saldo Bob", "nao creditou");

  // Idempotencia: 2ª execucao não duplica nada
  const beforeCount = awards.rows.length;
  const settledBefore = await pool.query<{ id: string; settled_at: string | null; settled_closure_id: string | null }>(
    `SELECT id::text, settled_at::text, settled_closure_id::text
       FROM tickets
      WHERE id::text = ANY($1::text[])
      ORDER BY id`,
    [[fx.tickets.diarioAlice, fx.tickets.diarioBob, fx.tickets.diarioCarol, fx.tickets.diarioFran]],
  );
  // ─── Encerramento: todos os tickets do closure devem ter `settled_at` ──
  const allSettled = settledBefore.rows.every((r) => r.settled_at != null);
  if (allSettled) pass("tickets DIARIO marcados como `settled_at` apos closure (4/4)");
  else fail("tickets settled_at apos closure", `${settledBefore.rows.filter((r) => r.settled_at != null).length}/4 settled`);
  const allHaveClosureId = settledBefore.rows.every((r) => r.settled_closure_id === closure.id);
  if (allHaveClosureId) pass("tickets DIARIO apontam para closure.id correto");
  else fail("tickets settled_closure_id", `closure esperado=${closure.id.slice(0, 8)}…`);

  // ─── Idempotencia total: rerodar nao duplica nada ──────────────────────
  await processPrizeClosuresAfterMatchSync({ source: "prod-test-diario-close-2" });
  const awards2 = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM prize_awards WHERE closure_id=$1`,
    [closure.id],
  );
  if (Number(awards2.rows[0]?.n ?? 0) === beforeCount) pass("idempotencia DIARIO: 2ª execucao nao duplicou awards");
  else fail("idempotencia DIARIO", `${awards2.rows[0]?.n} vs ${beforeCount}`);

  // Garante que o `settled_at` permaneceu IDENTICO (COALESCE evitou rewrite).
  const settledAfter = await pool.query<{ id: string; settled_at: string | null }>(
    `SELECT id::text, settled_at::text
       FROM tickets
      WHERE id::text = ANY($1::text[])
      ORDER BY id`,
    [[fx.tickets.diarioAlice, fx.tickets.diarioBob, fx.tickets.diarioCarol, fx.tickets.diarioFran]],
  );
  const sameSettledAt = settledBefore.rows.every((before, i) => before.settled_at === settledAfter.rows[i]?.settled_at);
  if (sameSettledAt) pass("idempotencia DIARIO: `settled_at` nao foi sobrescrito (COALESCE ok)");
  else fail("settled_at rewrite", "valores divergiram apos 2a execucao");

  // ─── Saldo dos premiados NAO duplicou ──────────────────────────────────
  const balAfter2 = await pool.query<{ name: string; balance_cents: number }>(
    `SELECT name, balance_cents FROM users WHERE email LIKE '${PREFIX}%@local' ORDER BY name`,
  );
  const bobAfter2 = balAfter2.rows.find((u) => u.name === "Prod bob")?.balance_cents ?? 0;
  if (bobAfter2 === bobAfter) pass("idempotencia DIARIO: saldo do Bob nao recreditou (transactions.external_ref unico)");
  else fail("saldo recreditou", `bob antes=${bobAfter} depois=${bobAfter2}`);

  // ─── prediction_scores NAO duplica ao recomputar ──────────────────────
  const scoresBefore = await pool.query<{ n: string; total: string | null }>(
    `SELECT count(*)::text AS n, sum(points)::text AS total
       FROM prediction_scores
      WHERE ticket_id = ANY($1::text[])`,
    [[fx.tickets.diarioAlice, fx.tickets.diarioBob, fx.tickets.diarioCarol, fx.tickets.diarioFran]],
  );
  // Re-persist identico → cascade nao deve recomputar nada
  await persistMatchesV2(
    [
      buildMockMatch({ competitionId: COMP_PRINCIPAL, matchId: fx.matches.diario[0]!, status: "Finalizado", casa: 1, visit: 0, kickoffMinFromNow: -360, dateBR: FAKE_DATE_GERAL_DIARIO }),
      buildMockMatch({ competitionId: COMP_PRINCIPAL, matchId: fx.matches.diario[1]!, status: "Finalizado", casa: 2, visit: 2, kickoffMinFromNow: -350, dateBR: FAKE_DATE_GERAL_DIARIO }),
      buildMockMatch({ competitionId: COMP_PRINCIPAL, matchId: fx.matches.diario[2]!, status: "Finalizado", casa: 0, visit: 1, kickoffMinFromNow: -340, dateBR: FAKE_DATE_GERAL_DIARIO }),
    ],
    { cascadeSource: "prod-test-diario-idempotent", runCascadingClosures: false },
  );
  const scoresAfter = await pool.query<{ n: string; total: string | null }>(
    `SELECT count(*)::text AS n, sum(points)::text AS total
       FROM prediction_scores
      WHERE ticket_id = ANY($1::text[])`,
    [[fx.tickets.diarioAlice, fx.tickets.diarioBob, fx.tickets.diarioCarol, fx.tickets.diarioFran]],
  );
  if (scoresBefore.rows[0]?.n === scoresAfter.rows[0]?.n && scoresBefore.rows[0]?.total === scoresAfter.rows[0]?.total) {
    pass("idempotencia DIARIO: prediction_scores nao duplicou (PK por prediction_id)");
  } else {
    fail("prediction_scores duplicou", `${JSON.stringify(scoresBefore.rows[0])} vs ${JSON.stringify(scoresAfter.rows[0])}`);
  }
}

// ─────────────────────────────────────────────────────────────────────
async function testExtraRodadaLifecycle(fx: SetupResult) {
  section("6) EXTRA por RODADA: ciclo + isolamento entre rodadas");
  // Finaliza R99 (E1=0x0, E2=2x1) e R100 (E_OTHER=3x3)
  await persistMatchesV2(
    [
      buildMockMatch({ competitionId: COMP_EXTRA, matchId: fx.matches.extraR99[0]!, status: "Finalizado", casa: 0, visit: 0, kickoffMinFromNow: -180, dateBR: FAKE_DATE_EXTRA, rodada: ROUND_NUMBER_FOCUS }),
      buildMockMatch({ competitionId: COMP_EXTRA, matchId: fx.matches.extraR99[1]!, status: "Finalizado", casa: 2, visit: 1, kickoffMinFromNow: -170, dateBR: FAKE_DATE_EXTRA, rodada: ROUND_NUMBER_FOCUS }),
      buildMockMatch({ competitionId: COMP_EXTRA, matchId: fx.matches.extraR100[0]!, status: "Finalizado", casa: 3, visit: 3, kickoffMinFromNow: -160, dateBR: FAKE_DATE_EXTRA, rodada: ROUND_NUMBER_OTHER }),
    ],
    { cascadeSource: "prod-test-extra", runCascadingClosures: false },
  );
  const totals = await getTicketsLiveTotalsBatch([
    fx.tickets.extraR99Alice, fx.tickets.extraR99Carol, fx.tickets.extraR99Daniel, fx.tickets.extraR100Daniel,
  ]);
  const aA = totals.get(fx.tickets.extraR99Alice)!;
  const aC = totals.get(fx.tickets.extraR99Carol)!;
  const aD = totals.get(fx.tickets.extraR99Daniel)!;
  const dOther = totals.get(fx.tickets.extraR100Daniel)!;
  // Alice (1,1)vs(0,0)=3 (outcome empate); (2,0)vs(2,1)=4 (outcome casa+1 gol) → 7
  if (aA.totalPoints === 7) pass("Alice EXTRA R99: 7 pts");
  else fail("Alice EXTRA R99", `obtido ${aA.totalPoints} ${JSON.stringify(aA)}`);
  // Carol (0,0)vs(0,0)=6 exato; (0,3)vs(2,1)=0 → 6
  if (aC.totalPoints === 6 && aC.exactCount === 1) pass("Carol EXTRA R99: 6 pts (1 exato)");
  else fail("Carol EXTRA R99", JSON.stringify(aC));
  // Daniel (2,1)vs(0,0)=0; (2,1)vs(2,1)=6 → 6
  if (aD.totalPoints === 6 && aD.exactCount === 1) pass("Daniel EXTRA R99: 6 pts (1 exato em E2)");
  else fail("Daniel EXTRA R99", JSON.stringify(aD));
  // Daniel R100: (1,1)vs(3,3)=3 outcome empate
  if (dOther.totalPoints === 3) pass("Daniel EXTRA R100: 3 pts (outcome empate)");
  else fail("Daniel EXTRA R100", JSON.stringify(dOther));

  // ISOLAMENTO: o palpite/score do ticket R99 do Daniel NÃO contém pontos do R100 (e vice-versa)
  if (aD.totalPoints !== dOther.totalPoints) {
    pass("isolamento entre rodadas: tickets R99 e R100 do mesmo usuario são separados", `R99=${aD.totalPoints}p R100=${dOther.totalPoints}p`);
  } else {
    fail("isolamento entre rodadas", "tickets confundiram pontos");
  }

  // Ranking extra: Alice (7) > Carol=Daniel (6=6) > Daniel R100 (3)
  // Limit 50 para garantir nossos 4 entrarem
  const rankExtra = await getLiveRankingTopByBolao("extra", { limit: 50 });
  const meus = rankExtra.filter((r) => [
    fx.tickets.extraR99Alice, fx.tickets.extraR99Carol, fx.tickets.extraR99Daniel, fx.tickets.extraR100Daniel,
  ].includes(r.ticketId));
  if (meus[0]?.ticketId === fx.tickets.extraR99Alice && meus[0].totalPoints === 7) {
    pass("ranking extra: 1º = Alice R99 (7 pts)");
  } else {
    fail("ranking extra topo", `obtido ${meus.map((m) => `${m.ticketId.slice(0,6)}=${m.totalPoints}`).join(", ")}`);
  }
}

// ─────────────────────────────────────────────────────────────────────
async function testMultiTicketMesmoUsuario(fx: SetupResult) {
  section("7) Multi-ticket mesmo usuario (Alice tem geral + diario + extra)");
  const ticketsAlice = [fx.tickets.geralAlice, fx.tickets.diarioAlice, fx.tickets.extraR99Alice];
  const totals = await getTicketsLiveTotalsBatch(ticketsAlice);
  const tg = totals.get(fx.tickets.geralAlice)!;
  const td = totals.get(fx.tickets.diarioAlice)!;
  const te = totals.get(fx.tickets.extraR99Alice)!;
  // Esperados: geral 18, diario 9, extra 7
  if (tg.totalPoints === 18 && td.totalPoints === 9 && te.totalPoints === 7) {
    pass("Alice tem 3 tickets isolados: geral=18 diario=9 extra=7", "");
  } else {
    fail("Alice multi-ticket", `geral=${tg.totalPoints} diario=${td.totalPoints} extra=${te.totalPoints}`);
  }

  // SUM agregada (rede de segurança extra): verifica que cada SUM é SOMENTE do ticket
  const pool = getPool();
  const sumAliceTotal = await pool.query<{ s: string }>(
    `SELECT COALESCE(SUM(points),0)::text AS s FROM prediction_scores WHERE user_id=$1`,
    [fx.users.alice],
  );
  const sumAlice = Number(sumAliceTotal.rows[0]?.s ?? 0);
  if (sumAlice === 18 + 9 + 7) {
    pass("SUM total Alice (todas as modalidades) = 34", "");
  } else {
    fail("SUM total Alice", `obtido ${sumAlice} esperado 34`);
  }
}

// ─────────────────────────────────────────────────────────────────────
async function testAntiCascata(fx: SetupResult) {
  section("8) Anti-cascata: re-persist identico = ZERO writes");
  const pool = getPool();
  const before = await pool.query<{ ts: string }>(
    `SELECT max(source_updated_at)::text AS ts FROM matches_cache WHERE match_id = ANY($1::bigint[])`,
    [[...fx.matches.geral, ...fx.matches.diario, ...fx.matches.extraR99]],
  );

  // Re-persiste TODOS exatamente como estão (final)
  const re = await persistMatchesV2(
    [
      buildMockMatch({ competitionId: COMP_PRINCIPAL, matchId: fx.matches.geral[0]!, status: "Finalizado", casa: 2, visit: 0, kickoffMinFromNow: -120, dateBR: FAKE_DATE_GERAL_DIARIO }),
      buildMockMatch({ competitionId: COMP_PRINCIPAL, matchId: fx.matches.geral[1]!, status: "Finalizado", casa: 3, visit: 2, kickoffMinFromNow: -110, dateBR: FAKE_DATE_GERAL_DIARIO }),
      buildMockMatch({ competitionId: COMP_PRINCIPAL, matchId: fx.matches.geral[2]!, status: "Finalizado", casa: 1, visit: 1, kickoffMinFromNow: -100, dateBR: FAKE_DATE_GERAL_DIARIO }),
      buildMockMatch({ competitionId: COMP_PRINCIPAL, matchId: fx.matches.diario[0]!, status: "Finalizado", casa: 1, visit: 0, kickoffMinFromNow: -360, dateBR: FAKE_DATE_GERAL_DIARIO }),
      buildMockMatch({ competitionId: COMP_PRINCIPAL, matchId: fx.matches.diario[1]!, status: "Finalizado", casa: 2, visit: 2, kickoffMinFromNow: -350, dateBR: FAKE_DATE_GERAL_DIARIO }),
      buildMockMatch({ competitionId: COMP_PRINCIPAL, matchId: fx.matches.diario[2]!, status: "Finalizado", casa: 0, visit: 1, kickoffMinFromNow: -340, dateBR: FAKE_DATE_GERAL_DIARIO }),
      buildMockMatch({ competitionId: COMP_EXTRA, matchId: fx.matches.extraR99[0]!, status: "Finalizado", casa: 0, visit: 0, kickoffMinFromNow: -180, dateBR: FAKE_DATE_EXTRA, rodada: ROUND_NUMBER_FOCUS }),
      buildMockMatch({ competitionId: COMP_EXTRA, matchId: fx.matches.extraR99[1]!, status: "Finalizado", casa: 2, visit: 1, kickoffMinFromNow: -170, dateBR: FAKE_DATE_EXTRA, rodada: ROUND_NUMBER_FOCUS }),
    ],
    { cascadeSource: "prod-test-anticascade", runCascadingClosures: false },
  );

  const after = await pool.query<{ ts: string }>(
    `SELECT max(source_updated_at)::text AS ts FROM matches_cache WHERE match_id = ANY($1::bigint[])`,
    [[...fx.matches.geral, ...fx.matches.diario, ...fx.matches.extraR99]],
  );
  if (re.written === 0 && re.scoredChangedIds.length === 0 && re.unchanged >= 8) {
    pass(`re-persist 8 partidas identicas: 0 writes, 0 scoredChanged, ${re.unchanged} unchanged`);
  } else {
    fail("anti-cascata counts", `written=${re.written} scoredChanged=${re.scoredChangedIds.length} unchanged=${re.unchanged}`);
  }
  if (before.rows[0]?.ts === after.rows[0]?.ts) pass("source_updated_at NAO mudou (zero UPDATE em matches_cache)");
  else fail("source_updated_at", `before=${before.rows[0]?.ts} after=${after.rows[0]?.ts}`);

  // Pontuação Alice continua igual
  const alice = await getTicketLiveTotals(fx.tickets.geralAlice);
  if (alice.totalPoints === 18) pass("Alice geral=18 pts mantido (anti-cascata nao zerou scores)");
  else fail("Alice apos anti-cascata", `${alice.totalPoints}`);
}

// ─────────────────────────────────────────────────────────────────────
async function testWorkerExcluiFinalizadas(fx: SetupResult) {
  section("9) Worker SQL nao seleciona partidas FINALIZADAS");
  const pool = getPool();
  // Mesmo com kickoff_at recente, finalizadas devem ser excluidas
  // Reproducao da query exata do realtime-worker.ts
  const { rows } = await pool.query<{ match_id: string; status: string }>(
    `SELECT match_id, status FROM matches_cache
      WHERE match_id = ANY($1::bigint[])
        AND kickoff_at IS NOT NULL
        AND kickoff_at >= now() - interval '6 hours'
        AND kickoff_at <= now() + interval '6 hours'
        AND lower(coalesce(status,'')) NOT IN (
          'finalizado','encerrado','cancelado','adiado','suspenso','interrompido','wo'
        )`,
    [[...fx.matches.geral, ...fx.matches.diario, ...fx.matches.extraR99, ...fx.matches.extraR100]],
  );
  if (rows.length === 0) {
    pass("query do worker exclui TODAS as partidas finalizadas", "0 entram na janela");
  } else {
    fail("worker incluiu finalizadas", `incluiu ${rows.length}: ${rows.map((r) => `${r.match_id}=${r.status}`).join(", ")}`);
  }
}

// ─────────────────────────────────────────────────────────────────────
async function testCountsConsistency() {
  section("10) Consistencia: contagens em prediction_scores");
  const pool = getPool();
  // 9 (geral) + 12 (diario) + 6 (extra r99) + 1 (extra r100) = 28
  const { rows } = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM prediction_scores
     WHERE ticket_id IN (SELECT id::text FROM tickets WHERE external_ref LIKE 'TEST_PROD_%')`,
  );
  const n = Number(rows[0]?.n ?? 0);
  if (n === 28) pass("28 linhas em prediction_scores (9 geral + 12 diario + 6 extraR99 + 1 extraR100)");
  else fail("contagem prediction_scores", `obtido ${n} esperado 28`);
}

// ─────────────────────────────────────────────────────────────────────
/**
 * Cenario que o USUARIO descreveu:
 *   "quando todos jogos acabarem tem que mudar o status do ticket, sacao,
 *    para nao duplicar pontos"
 *
 * Aqui validamos o ciclo FIM-A-FIM:
 *   1. Todos os jogos do bolao EXTRA R99 estao finalizados (test 6 finalizou).
 *   2. Forcamos o kickoff para alem do grace do daily closure.
 *   3. Rodamos `processPrizeClosuresAfterMatchSync` ⇒ cria closure EXTRA.
 *   4. Tickets EXTRA R99 viram `settled_at IS NOT NULL`.
 *   5. Tickets EXTRA R100 (ainda nao todos finalizados? na vdd só 1 jogo,
 *      tambem finalizado) viram settled_at se passarem do grace.
 *   6. Rerodar TUDO: ZERO duplicacao em scores/awards/transactions/saldos.
 *   7. `settled_at` permanece o mesmo (auditavel).
 */
async function testEncerramentoTotal(fx: SetupResult) {
  section("11) Encerramento total: ticket settled apos todos jogos terminarem");
  const pool = getPool();

  // Forca grace dos EXTRAS (kickoff -6h, igual ao DIARIO test)
  await pool.query(
    `UPDATE matches_cache SET kickoff_at = now() - interval '6 hours'
     WHERE date_br = $1 AND competition_id = $2`,
    [FAKE_DATE_EXTRA, COMP_EXTRA],
  );

  // Snapshot ANTES do closure
  const balBefore = await pool.query<{ id: string; balance_cents: number }>(
    `SELECT id::text, balance_cents FROM users WHERE email LIKE '${PREFIX}%@local' ORDER BY id`,
  );
  const scoresBefore = await pool.query<{ n: string; total: string | null }>(
    `SELECT count(*)::text AS n, sum(points)::text AS total
       FROM prediction_scores
      WHERE ticket_id IN (SELECT id::text FROM tickets WHERE external_ref LIKE '${PREFIX}%')`,
  );

  await processPrizeClosuresAfterMatchSync({ source: "prod-test-encerramento" });

  // 1) Tickets EXTRA viraram settled?
  const extraTickets = [fx.tickets.extraR99Alice, fx.tickets.extraR99Carol, fx.tickets.extraR99Daniel, fx.tickets.extraR100Daniel];
  const extraSettled = await pool.query<{ id: string; settled_at: string | null; settled_closure_id: string | null }>(
    `SELECT id::text, settled_at::text, settled_closure_id::text
       FROM tickets
      WHERE id::text = ANY($1::text[])
      ORDER BY id`,
    [extraTickets],
  );
  const nSettled = extraSettled.rows.filter((r) => r.settled_at != null).length;
  if (nSettled === extraTickets.length) {
    pass(`tickets EXTRA marcados settled apos todos jogos finalizarem (${nSettled}/${extraTickets.length})`);
  } else {
    fail("tickets EXTRA settled", `${nSettled}/${extraTickets.length} settled — ${extraSettled.rows.map((r) => `${r.id.slice(0, 6)}=${r.settled_at ? "ok" : "null"}`).join(", ")}`);
  }

  // 2) Closure EXTRA gravado
  const closures = await pool.query<{ id: string; bolao_type: string; date_br: string | null; processado: boolean }>(
    `SELECT id::text, bolao_type, date_br, processado FROM prize_closures WHERE date_br = $1 ORDER BY bolao_type`,
    [FAKE_DATE_EXTRA],
  );
  if (closures.rows.some((c) => c.bolao_type === "extra" && c.processado)) {
    pass("closure EXTRA criado e processado=true");
  } else {
    fail("closure EXTRA", `obtido ${JSON.stringify(closures.rows)}`);
  }

  // 3) Idempotencia TOTAL: rerodar fechamento + persist nao duplica nada
  await processPrizeClosuresAfterMatchSync({ source: "prod-test-encerramento-2" });
  await processPrizeClosuresAfterMatchSync({ source: "prod-test-encerramento-3" });

  const balAfter = await pool.query<{ id: string; balance_cents: number }>(
    `SELECT id::text, balance_cents FROM users WHERE email LIKE '${PREFIX}%@local' ORDER BY id`,
  );
  const scoresAfter = await pool.query<{ n: string; total: string | null }>(
    `SELECT count(*)::text AS n, sum(points)::text AS total
       FROM prediction_scores
      WHERE ticket_id IN (SELECT id::text FROM tickets WHERE external_ref LIKE '${PREFIX}%')`,
  );
  const totalCreditChange = balAfter.rows.reduce((acc, row, i) => {
    const prev = balBefore.rows[i]?.balance_cents ?? 0;
    return acc + Math.max(0, row.balance_cents - prev);
  }, 0);
  // O credito ja aconteceu na 1a chamada do closure (extra) - mas a 2a e 3a NAO devem creditar novamente.
  // Verificamos rodando processClosure MAIS 2x apos a 1a: total nao cresce.
  const balRound2 = await pool.query<{ id: string; balance_cents: number }>(
    `SELECT id::text, balance_cents FROM users WHERE email LIKE '${PREFIX}%@local' ORDER BY id`,
  );
  await processPrizeClosuresAfterMatchSync({ source: "prod-test-encerramento-4" });
  const balRound3 = await pool.query<{ id: string; balance_cents: number }>(
    `SELECT id::text, balance_cents FROM users WHERE email LIKE '${PREFIX}%@local' ORDER BY id`,
  );
  const driftDiff = balRound2.rows.every((r, i) => r.balance_cents === balRound3.rows[i]?.balance_cents);
  if (driftDiff) pass("idempotencia TOTAL: rerodar closure 4× nao recreditou saldos");
  else fail("recredito apos n-rodadas", "saldos divergiram");

  if (scoresBefore.rows[0]?.n === scoresAfter.rows[0]?.n) {
    pass("idempotencia TOTAL: prediction_scores nao duplicou");
  } else {
    fail("scores duplicou", `${JSON.stringify(scoresBefore.rows[0])} vs ${JSON.stringify(scoresAfter.rows[0])}`);
  }

  // settled_at permanece o original (COALESCE evitou rewrite)
  const extraSettledAfter = await pool.query<{ id: string; settled_at: string | null }>(
    `SELECT id::text, settled_at::text FROM tickets WHERE id::text = ANY($1::text[]) ORDER BY id`,
    [extraTickets],
  );
  const settledStable = extraSettled.rows.every((b, i) => b.settled_at === extraSettledAfter.rows[i]?.settled_at);
  if (settledStable) pass("idempotencia TOTAL: settled_at permanece o original (COALESCE)");
  else fail("settled_at sobrescrito", "valores divergiram apos reexecucao");

  info(`credito total registrado: R$ ${(totalCreditChange / 100).toFixed(2)}`);

  // 4) Sanity: tickets settled NAO aparecem na "fila aberta" (index_tickets_open)
  const openTickets = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM tickets
      WHERE external_ref LIKE '${PREFIX}%'
        AND settled_at IS NULL
        AND ticket_type = 'extra'`,
  );
  // R100 do Daniel só tem 1 jogo, que foi finalizado. Junto com R99 = todos 4 settled.
  if (Number(openTickets.rows[0]?.n ?? 0) === 0) {
    pass("nenhum ticket EXTRA fica em aberto apos todos jogos finalizarem");
  } else {
    fail("tickets EXTRA em aberto", `${openTickets.rows[0]?.n} ainda nao settled`);
  }
}

// ─────────────────────────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  console.log(`${C.bold}${C.magenta}TESTE FULL PRE-DEPLOY (PRODUCAO)${C.reset}\n${C.gray}data: ${new Date().toISOString()}${C.reset}\n`);
  console.log(`${C.yellow}atencao:${C.reset} este teste mexe no banco REAL com sentinels (TEST_PROD_*).`);
  console.log(`${C.gray}cleanup inicial e final cuidam de limpar tudo.${C.reset}`);

  await ensureDatabasePoolReady();
  section("0) Cleanup pre-existente");
  await cleanup();
  pass("limpeza inicial ok");

  let fx: SetupResult | null = null;
  try {
    fx = await setup();
    await createAllPredictions(fx);
    await testFormulaPontuacao();
    await testGeralLifecycle(fx);
    await testDiarioLifecycle(fx);
    await testExtraRodadaLifecycle(fx);
    await testMultiTicketMesmoUsuario(fx);
    await testAntiCascata(fx);
    await testWorkerExcluiFinalizadas(fx);
    await testCountsConsistency();
    await testEncerramentoTotal(fx);
  } catch (err) {
    console.error("\n[fatal]", err);
  } finally {
    section("CLEANUP FINAL");
    try {
      await cleanup();
      pass("tudo removido (users, tickets, predictions, scores, mocks, closures, awards, transactions)");
    } catch (err) {
      fail("cleanup", err instanceof Error ? err.message : String(err));
    }
  }

  // ─────────── RELATÓRIO ───────────
  section("RELATORIO FINAL");
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
  if (ff === 0) {
    console.log(`\n  ${C.green}${C.bold}✓✓✓ TUDO VERDE — PODE SUBIR PRA PRODUCAO ✓✓✓${C.reset}`);
  } else {
    console.log(`\n  ${C.red}${C.bold}✗✗✗ NAO SUBIR — ${ff} FALHA${ff > 1 ? "S" : ""} ✗✗✗${C.reset}`);
  }
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
