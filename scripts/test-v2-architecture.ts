/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Teste end-to-end da arquitetura v2 (bolão).
 *
 * Roda via:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/test-v2-architecture.ts
 *
 * O script:
 *   1) confere envs e conexao com Postgres
 *   2) confere as colunas/tabelas criadas pela migration v2
 *   3) chama o provider REAL (API Futebol) e mostra dados
 *   4) chama persist + verifica que TODAS as colunas novas vieram preenchidas
 *   5) roda syncAllConfigured + idempotencia
 *   6) testa a query SQL do realtime worker com linhas mock
 *   7) testa helpers extras-rodada
 *   8) cleanup + relatorio PASS/FAIL
 *
 * Nao deleta dados de producao. Linhas mock usam competition_id sentinel = -999.
 */

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env" });

import {
  fetchChampionshipSnapshot,
  fetchPrincipalMatches,
  fetchRodadaMatches,
  fetchMatchDetailById,
  type ProviderMatchV2,
} from "@/lib/football/provider";
import {
  persistMatchesV2,
  persistChampionshipSnapshot,
  readChampionshipSnapshot,
} from "@/lib/football/persistence";
import {
  syncAllConfigured,
  syncPrincipal,
  syncExtra,
} from "@/lib/football/sync-orchestrator";
import {
  resolveCurrentExtraRound,
  listMatchesForExtraRound,
} from "@/lib/football/extras-rodada";
import {
  getFootballMainCompetitionId,
  parseExtraBolaoChampionshipIds,
} from "@/lib/boloes-extra-config";
import { getPool, ensureDatabasePoolReady } from "@/lib/db";

// --------------------------------------------------------------------
// Helpers de saída
// --------------------------------------------------------------------

const COLOR = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
};

const results: Array<{ section: string; name: string; status: "PASS" | "FAIL" | "SKIP"; detail?: string }> = [];

function section(title: string): void {
  console.log(`\n${COLOR.cyan}${COLOR.bold}━━━ ${title} ${"━".repeat(Math.max(0, 70 - title.length))}${COLOR.reset}`);
}

function pass(section: string, name: string, detail?: string): void {
  results.push({ section, name, status: "PASS", detail });
  console.log(`  ${COLOR.green}✓${COLOR.reset} ${name}${detail ? `  ${COLOR.gray}${detail}${COLOR.reset}` : ""}`);
}

function fail(section: string, name: string, detail: string): void {
  results.push({ section, name, status: "FAIL", detail });
  console.log(`  ${COLOR.red}✗${COLOR.reset} ${name}  ${COLOR.red}${detail}${COLOR.reset}`);
}

function skip(section: string, name: string, reason: string): void {
  results.push({ section, name, status: "SKIP", detail: reason });
  console.log(`  ${COLOR.yellow}○${COLOR.reset} ${name}  ${COLOR.gray}${reason}${COLOR.reset}`);
}

function info(msg: string): void {
  console.log(`    ${COLOR.gray}${msg}${COLOR.reset}`);
}

// --------------------------------------------------------------------
// Constantes
// --------------------------------------------------------------------

const MOCK_COMP_ID = -999;
const MOCK_BASE = 999_990_000; // match_id base para mocks

// --------------------------------------------------------------------
// Cleanup mocks
// --------------------------------------------------------------------

async function cleanupMocks(): Promise<void> {
  const pool = getPool();
  await pool.query(`DELETE FROM matches_cache WHERE competition_id = $1`, [MOCK_COMP_ID]);
  await pool.query(`DELETE FROM championships_cache WHERE competition_id = $1`, [MOCK_COMP_ID]);
}

// --------------------------------------------------------------------
// Testes
// --------------------------------------------------------------------

async function testEnvsAndDb(): Promise<void> {
  section("1) Env + DB + Migration v2");
  const SECTION = "env";

  const requiredEnv = [
    "DATABASE_HOST",
    "DATABASE_USER",
    "DATABASE_NAME",
    "FOOTBALL_API_TOKEN",
    "FOOTBALL_COMPETITION_ID",
  ];
  for (const k of requiredEnv) {
    if (!process.env[k]?.trim()) {
      fail(SECTION, `env ${k}`, "ausente ou vazio");
      return;
    }
    pass(SECTION, `env ${k}`, k === "FOOTBALL_API_TOKEN" ? "definido (oculto)" : `= ${process.env[k]}`);
  }

  await ensureDatabasePoolReady();
  pass(SECTION, "pool postgres", "conectado");

  const pool = getPool();

  // Colunas novas em matches_cache
  const expectedMcCols = [
    "slug",
    "disputa_penalti",
    "penaltis_casa",
    "penaltis_visitante",
    "data_realizacao_iso",
    "rodada",
    "rodada_slug",
    "fase_nome",
    "fase_slug",
    "championship_name",
    "championship_slug",
    "championship_temporada",
    "home_team_id",
    "away_team_id",
    "estadio_id",
    "estadio_nome",
    "provider_payload",
  ];
  const { rows: mcCols } = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='matches_cache' AND column_name = ANY($1::text[])`,
    [expectedMcCols],
  );
  const found = new Set(mcCols.map((r) => r.column_name));
  const missing = expectedMcCols.filter((c) => !found.has(c));
  if (missing.length === 0) pass(SECTION, "matches_cache: 17 colunas novas", "todas presentes");
  else fail(SECTION, "matches_cache: colunas novas", `faltando: ${missing.join(", ")}`);

  // championships_cache
  const { rows: chRows } = await pool.query(
    `SELECT to_regclass('public.championships_cache') AS t`,
  );
  if (chRows[0]?.t) pass(SECTION, "championships_cache existe", "");
  else fail(SECTION, "championships_cache existe", "tabela ausente");

  // tickets.round_number
  const { rows: tk } = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='tickets' AND column_name='round_number'`,
  );
  if (tk.length === 1) pass(SECTION, "tickets.round_number existe", "");
  else fail(SECTION, "tickets.round_number existe", "coluna ausente");

  // sync_run_log
  const { rows: sl } = await pool.query(`SELECT to_regclass('public.sync_run_log') AS t`);
  if (sl[0]?.t) pass(SECTION, "sync_run_log existe", "");
  else fail(SECTION, "sync_run_log existe", "tabela ausente");

  // Indices
  const expectedIdx = [
    "idx_matches_cache_active_window",
    "idx_matches_cache_competition_round",
    "idx_championships_cache_slug",
    "idx_tickets_extra_round",
    "idx_sync_run_log_started_at",
  ];
  const { rows: idx } = await pool.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE indexname = ANY($1::text[])`,
    [expectedIdx],
  );
  const idxFound = new Set(idx.map((r) => r.indexname));
  const idxMissing = expectedIdx.filter((i) => !idxFound.has(i));
  if (idxMissing.length === 0) pass(SECTION, "5 indices criados", "");
  else fail(SECTION, "indices da migration", `faltando: ${idxMissing.join(", ")}`);
}

async function testProvider(): Promise<{
  principal: ProviderMatchV2[];
  extraRodadas: Map<number, { rodada: number; matches: ProviderMatchV2[] }>;
} | null> {
  section("2) Provider — API Futebol REAL");
  const SECTION = "provider";

  const principal = getFootballMainCompetitionId();
  const extras = parseExtraBolaoChampionshipIds();

  // Snapshot principal
  let principalSnap;
  try {
    principalSnap = await fetchChampionshipSnapshot(principal);
    pass(
      SECTION,
      `snapshot principal (${principal})`,
      `${principalSnap.nome} | ${principalSnap.temporada ?? "-"} | status=${principalSnap.status ?? "-"}`,
    );
  } catch (err) {
    fail(SECTION, `snapshot principal (${principal})`, err instanceof Error ? err.message : String(err));
    return null;
  }

  // Partidas principal
  let principalMatches: ProviderMatchV2[];
  try {
    principalMatches = await fetchPrincipalMatches(principal, principalSnap);
    if (principalMatches.length === 0) {
      fail(SECTION, "partidas principal", "lista vazia");
      return null;
    }
    pass(SECTION, "partidas principal", `${principalMatches.length} partidas`);
    const sample = principalMatches[0]!;
    info(
      `amostra: id=${sample.matchId} ${sample.homeName} ${sample.resultCasa ?? "-"}x${sample.resultVisitante ?? "-"} ${sample.awayName} | status=${sample.status} | kickoff=${sample.kickoffAt}`,
    );
    info(
      `slug=${sample.slug} | rodada=${sample.rodada} | championship=${sample.championshipNome} | estadio=${sample.estadioNome}`,
    );
    // Validacao de campos obrigatorios da spec
    const requiredFields: Array<keyof ProviderMatchV2> = [
      "matchId",
      "status",
      "kickoffAt",
      "dataRealizacao",
      "horaRealizacao",
      "homeName",
      "awayName",
      "homeSigla",
      "awaySigla",
    ];
    const missingFields = requiredFields.filter((k) => sample[k] == null || sample[k] === "");
    if (missingFields.length === 0) pass(SECTION, "partida tem todos os campos canonicos", "");
    else fail(SECTION, "partida campos canonicos", `vazios: ${missingFields.join(", ")}`);
  } catch (err) {
    fail(SECTION, "partidas principal", err instanceof Error ? err.message : String(err));
    return null;
  }

  // Snapshot + rodada extras
  const extraRodadas = new Map<number, { rodada: number; matches: ProviderMatchV2[] }>();
  for (const id of extras) {
    try {
      const snap = await fetchChampionshipSnapshot(id);
      pass(
        SECTION,
        `snapshot extra (${id})`,
        `${snap.nome} | rodada_atual=${snap.rodadaAtual?.numero ?? "-"} (${snap.rodadaAtual?.status ?? "-"})`,
      );
      const rodada = snap.rodadaAtual?.numero;
      if (!rodada) {
        skip(SECTION, `partidas extra ${id} rodada`, "snapshot sem rodada_atual");
        continue;
      }
      const matches = await fetchRodadaMatches(id, rodada, snap);
      if (matches.length === 0) {
        fail(SECTION, `partidas extra ${id} rodada ${rodada}`, "lista vazia");
        continue;
      }
      pass(SECTION, `partidas extra ${id} rodada ${rodada}`, `${matches.length} partidas`);
      extraRodadas.set(id, { rodada, matches });
      const sample = matches[0]!;
      info(
        `amostra: id=${sample.matchId} ${sample.homeName} vs ${sample.awayName} | rodada=${sample.rodada}`,
      );
    } catch (err) {
      fail(SECTION, `extra ${id}`, err instanceof Error ? err.message : String(err));
    }
  }

  // Detalhe de uma partida — endpoint que o realtime worker usa
  try {
    const sampleId = principalMatches[0]!.matchId;
    const detail = await fetchMatchDetailById(sampleId);
    if (!detail) fail(SECTION, `detail /partidas/${sampleId}`, "retornou null");
    else pass(SECTION, `detail /partidas/${sampleId}`, `status=${detail.status}, score=${detail.resultCasa ?? "-"}x${detail.resultVisitante ?? "-"}`);
  } catch (err) {
    fail(SECTION, "detail by id", err instanceof Error ? err.message : String(err));
  }

  return { principal: principalMatches, extraRodadas };
}

async function testPersistence(
  providerData: NonNullable<Awaited<ReturnType<typeof testProvider>>>,
): Promise<void> {
  section("3) Persistence — gravar + cascata");
  const SECTION = "persist";
  const pool = getPool();

  const principalCompId = getFootballMainCompetitionId();

  // Antes da gravacao
  const { rows: beforeRows } = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM matches_cache WHERE competition_id = $1`,
    [principalCompId],
  );
  const before = Number(beforeRows[0]?.n ?? 0);
  info(`matches_cache (comp ${principalCompId}) antes: ${before}`);

  // Persist principal
  try {
    const out = await persistMatchesV2(providerData.principal.slice(0, 30), {
      cascadeSource: "test-v2-script",
      runCascadingClosures: false,
    });
    pass(SECTION, "persistMatchesV2 principal", `written=${out.written}, changedIds=${out.changedMatchIds.length}`);
  } catch (err) {
    fail(SECTION, "persistMatchesV2 principal", err instanceof Error ? err.message : String(err));
    return;
  }

  // Validar que TODAS as colunas novas vieram preenchidas em pelo menos 1 row
  const { rows: validate } = await pool.query<{
    has_slug: number;
    has_rodada: number;
    has_championship_name: number;
    has_home_team_id: number;
    has_estadio_id: number;
    has_payload: number;
  }>(
    `SELECT
       count(*) FILTER (WHERE slug IS NOT NULL)::int AS has_slug,
       count(*) FILTER (WHERE rodada IS NOT NULL)::int AS has_rodada,
       count(*) FILTER (WHERE championship_name IS NOT NULL)::int AS has_championship_name,
       count(*) FILTER (WHERE home_team_id IS NOT NULL)::int AS has_home_team_id,
       count(*) FILTER (WHERE estadio_id IS NOT NULL)::int AS has_estadio_id,
       count(*) FILTER (WHERE provider_payload IS NOT NULL)::int AS has_payload
     FROM matches_cache
     WHERE competition_id = $1`,
    [principalCompId],
  );
  const v = validate[0]!;
  // slug, championship_name, home_team_id, payload sao garantidos pela API
  // rodada e estadio_id podem variar — informativos
  if (v.has_slug > 0) pass(SECTION, "coluna slug preenchida", `${v.has_slug} linhas`);
  else fail(SECTION, "coluna slug preenchida", "nenhuma linha");
  if (v.has_championship_name > 0) pass(SECTION, "coluna championship_name preenchida", `${v.has_championship_name} linhas`);
  else fail(SECTION, "coluna championship_name", "nenhuma linha");
  if (v.has_home_team_id > 0) pass(SECTION, "coluna home_team_id preenchida", `${v.has_home_team_id} linhas`);
  else fail(SECTION, "coluna home_team_id", "nenhuma linha");
  if (v.has_payload > 0) pass(SECTION, "coluna provider_payload preenchida", `${v.has_payload} linhas`);
  else fail(SECTION, "coluna provider_payload", "nenhuma linha");
  // estadio_id e rodada — informativos:
  info(`coluna rodada preenchida em ${v.has_rodada} linhas (informativo)`);
  info(`coluna estadio_id preenchida em ${v.has_estadio_id} linhas (informativo — depende de a API retornar)`);

  // Persistir snapshot do principal e ler de volta
  const principalSnap = await fetchChampionshipSnapshot(principalCompId);
  await persistChampionshipSnapshot(principalSnap);
  const readBack = await readChampionshipSnapshot(principalCompId);
  if (readBack && readBack.nome === principalSnap.nome) {
    pass(SECTION, "championships_cache: write+read", `${readBack.nome} (rodada_atual=${readBack.rodada_atual_numero})`);
  } else {
    fail(SECTION, "championships_cache: write+read", "nao retornou");
  }

  // Persist extras
  for (const [compId, info] of providerData.extraRodadas) {
    try {
      const out = await persistMatchesV2(info.matches.slice(0, 20), {
        cascadeSource: `test-v2-script-extra:${compId}`,
        runCascadingClosures: false,
      });
      pass(SECTION, `persistMatchesV2 extra ${compId} rodada ${info.rodada}`, `written=${out.written}`);
      const { rows } = await pool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM matches_cache WHERE competition_id = $1 AND rodada = $2`,
        [compId, info.rodada],
      );
      pass(SECTION, `matches_cache filtrando por rodada ${info.rodada}`, `${rows[0]?.n} linhas`);
    } catch (err) {
      fail(SECTION, `persistMatchesV2 extra ${compId}`, err instanceof Error ? err.message : String(err));
    }
  }
}

async function testDedupe(
  providerData: NonNullable<Awaited<ReturnType<typeof testProvider>>>,
): Promise<void> {
  section("3.1) Persistence — dedupe (API duplica partidas em ida/volta)");
  const SECTION = "dedupe";

  // Cria payload deliberadamente duplicado (mesma partida 3 vezes)
  const original = providerData.principal[0]!;
  const dup1 = { ...original };
  const dup2 = { ...original, status: "agendado" };
  const dup3 = { ...original, status: "ao vivo", resultCasa: 0, resultVisitante: 0 };
  try {
    const out = await persistMatchesV2([dup1, dup2, dup3], {
      cascadeSource: "test-dedupe",
      runCascadingClosures: false,
    });
    if (out.written === 1 && out.deduped === 2) {
      pass(SECTION, "deduplicou 3 ocorrencias da mesma partida em 1", `written=${out.written}, deduped=${out.deduped}`);
    } else {
      fail(SECTION, "dedupe", `esperado written=1 deduped=2, obteve written=${out.written} deduped=${out.deduped}`);
    }
  } catch (err) {
    fail(SECTION, "persist com duplicatas", err instanceof Error ? err.message : String(err));
  }
}

async function testOrchestrator(): Promise<void> {
  section("4) Orchestrator — syncAllConfigured + idempotencia");
  const SECTION = "orchestrator";
  const pool = getPool();

  // Snapshot dos counts pre-execucao
  const { rows: before } = await pool.query<{ competition_id: number; n: string }>(
    `SELECT competition_id, count(*)::text AS n
     FROM matches_cache
     WHERE competition_id > 0
     GROUP BY competition_id
     ORDER BY competition_id`,
  );
  info(`pre: ${before.map((r) => `comp${r.competition_id}=${r.n}`).join(", ") || "(vazio)"}`);

  let r1: any, r2: any;
  try {
    r1 = await syncAllConfigured();
    pass(SECTION, "syncAllConfigured (1ª)", `principal=${r1.principal?.matchesPersisted ?? 0}, extras=${r1.extras.map((e: any) => `${e.competitionId}:${e.matchesPersisted}`).join(",") || "-"}`);
  } catch (err) {
    fail(SECTION, "syncAllConfigured (1ª)", err instanceof Error ? err.message : String(err));
    return;
  }

  // Segunda execucao: deve atualizar SEM duplicar
  try {
    r2 = await syncAllConfigured();
    pass(SECTION, "syncAllConfigured (2ª)", `principal=${r2.principal?.matchesPersisted ?? 0}`);
  } catch (err) {
    fail(SECTION, "syncAllConfigured (2ª)", err instanceof Error ? err.message : String(err));
    return;
  }

  const { rows: after } = await pool.query<{ competition_id: number; n: string }>(
    `SELECT competition_id, count(*)::text AS n
     FROM matches_cache
     WHERE competition_id > 0
     GROUP BY competition_id
     ORDER BY competition_id`,
  );
  info(`pos: ${after.map((r) => `comp${r.competition_id}=${r.n}`).join(", ")}`);

  // Confirma idempotencia: counts iguais entre 1ª e 2ª
  const beforeMap = new Map(before.map((r) => [r.competition_id, Number(r.n)]));
  const afterMap = new Map(after.map((r) => [r.competition_id, Number(r.n)]));
  let stable = true;
  let detail = "";
  for (const [k, v] of afterMap) {
    const prev = beforeMap.get(k) ?? 0;
    if (v < prev) {
      stable = false;
      detail = `comp ${k}: ${prev} -> ${v} (perdeu linhas!)`;
      break;
    }
  }
  if (stable) pass(SECTION, "idempotencia (counts so crescem)", "ok");
  else fail(SECTION, "idempotencia", detail);
}

async function testRealtimeWorkerQuery(): Promise<void> {
  section("5) Realtime Worker — query SQL com mocks");
  const SECTION = "worker";
  const pool = getPool();

  // 5 mocks com cenarios diferentes (todos com competition_id sentinel)
  const now = new Date();
  const minute = 60_000;
  const mocks = [
    {
      id: MOCK_BASE + 1,
      label: "ao_vivo",
      status: "ao vivo",
      kickoff: new Date(now.getTime() - 30 * minute),
      shouldSelect: true,
    },
    {
      id: MOCK_BASE + 2,
      label: "agendado_apito_iminente",
      status: "agendado",
      kickoff: new Date(now.getTime() + 2 * minute),
      shouldSelect: true,
    },
    {
      id: MOCK_BASE + 3,
      label: "andamento_dentro_janela",
      status: "andamento",
      kickoff: new Date(now.getTime() - 60 * minute),
      shouldSelect: true,
    },
    {
      id: MOCK_BASE + 4,
      label: "finalizado_recente",
      status: "finalizado",
      kickoff: new Date(now.getTime() - 30 * minute),
      shouldSelect: false,
    },
    {
      id: MOCK_BASE + 5,
      label: "encerrado",
      status: "encerrado",
      kickoff: new Date(now.getTime() - 30 * minute),
      shouldSelect: false,
    },
    {
      id: MOCK_BASE + 6,
      label: "cancelado",
      status: "cancelado",
      kickoff: new Date(now.getTime() - 30 * minute),
      shouldSelect: false,
    },
    {
      id: MOCK_BASE + 7,
      label: "agendado_muito_no_futuro",
      status: "agendado",
      kickoff: new Date(now.getTime() + 600 * minute),
      shouldSelect: false,
    },
    {
      id: MOCK_BASE + 8,
      label: "agendado_passou_da_janela",
      status: "agendado",
      kickoff: new Date(now.getTime() - 240 * minute),
      shouldSelect: false,
    },
    {
      id: MOCK_BASE + 9,
      label: "intervalo",
      status: "intervalo",
      kickoff: new Date(now.getTime() - 50 * minute),
      shouldSelect: true,
    },
  ];

  // Insert mocks com TODAS as colunas necessarias do matches_cache
  await cleanupMocks();
  for (const m of mocks) {
    await pool.query(
      `INSERT INTO matches_cache (
         competition_id, match_id, status, kickoff_at, date_br, hour_br,
         home_name, home_sigla, away_name, away_sigla,
         source_updated_at, synced_at
       ) VALUES ($1,$2,$3,$4,'01/01/1970','00:00','MOCK','MK','MOCK','MK',now(),now())`,
      [MOCK_COMP_ID, m.id, m.status, m.kickoff.toISOString()],
    );
  }
  pass(SECTION, "inseriu 9 mocks", `competition_id=${MOCK_COMP_ID}`);

  // Roda EXATAMENTE a mesma query do realtime worker
  // (copiada literalmente de lib/football/realtime-worker.ts)
  const SELECT_SQL = `
    SELECT competition_id, match_id, status, kickoff_at::text AS kickoff_at
    FROM matches_cache mc
    WHERE
      lower(coalesce(status, '')) NOT LIKE '%finaliz%'
      AND lower(coalesce(status, '')) NOT LIKE '%encerr%'
      AND lower(coalesce(status, '')) NOT LIKE '%cancel%'
      AND lower(coalesce(status, '')) NOT LIKE '%adiad%'
      AND lower(coalesce(status, '')) NOT LIKE '%suspens%'
      AND lower(coalesce(status, '')) NOT LIKE '%interromp%'
      AND (
        lower(coalesce(status, '')) LIKE '%andamento%'
        OR lower(coalesce(status, '')) LIKE '%ao vivo%'
        OR lower(coalesce(status, '')) LIKE '%intervalo%'
        OR lower(coalesce(status, '')) LIKE '%pausad%'
        OR lower(coalesce(status, '')) LIKE '%em curso%'
        OR (
          kickoff_at IS NOT NULL
          AND kickoff_at <= now() + ($1::text || ' minutes')::interval
          AND kickoff_at >= now() - ($2::text || ' minutes')::interval
        )
      )
      AND competition_id = $3
    ORDER BY kickoff_at ASC
    LIMIT 100
  `;
  const { rows: selected } = await pool.query<{ match_id: number; status: string }>(
    SELECT_SQL,
    ["5", "180", MOCK_COMP_ID],
  );
  const selectedIds = new Set(selected.map((r) => Number(r.match_id)));

  for (const m of mocks) {
    const isSelected = selectedIds.has(m.id);
    const desc = `${m.label} (${m.status}, kickoff=${m.kickoff.toISOString().slice(0, 16)}Z)`;
    if (isSelected === m.shouldSelect) {
      pass(SECTION, `${m.shouldSelect ? "ENTRA" : "FORA"}  ${desc}`, "");
    } else {
      fail(
        SECTION,
        `${m.shouldSelect ? "deveria ENTRAR" : "deveria FICAR FORA"}: ${desc}`,
        `worker selecionou=${isSelected}`,
      );
    }
  }
}

async function testExtrasRodada(): Promise<void> {
  section("6) Helpers extras-rodada");
  const SECTION = "extras";

  const extras = parseExtraBolaoChampionshipIds();
  if (extras.length === 0) {
    skip(SECTION, "BOLOES_EXTRA_CHAMPIONSHIP_IDS", "nenhum extra configurado — sem teste");
    return;
  }
  for (const id of extras) {
    const r = await resolveCurrentExtraRound(id);
    if (!r) {
      fail(SECTION, `resolveCurrentExtraRound(${id})`, "null");
      continue;
    }
    pass(
      SECTION,
      `resolveCurrentExtraRound(${id})`,
      `${r.championshipNome} — Rodada ${r.rodada} (${r.rodadaStatus ?? "-"})`,
    );

    const matches = await listMatchesForExtraRound(id, r.rodada);
    if (matches.length === 0) {
      fail(SECTION, `listMatchesForExtraRound(${id}, ${r.rodada})`, "0 partidas — esperado >= 1 apos sync");
      continue;
    }
    pass(SECTION, `listMatchesForExtraRound(${id}, ${r.rodada})`, `${matches.length} partidas`);

    // Confere estrutura: rodada e championship_id batem
    const wrong = matches.filter(
      (m) => Number(m.competition_id) !== id || Number(m.rodada) !== r.rodada,
    );
    if (wrong.length === 0) pass(SECTION, "todas as partidas tem rodada/comp corretos", "");
    else fail(SECTION, "rodada/comp das partidas", `${wrong.length} divergentes`);
  }
}

// --------------------------------------------------------------------
// Main
// --------------------------------------------------------------------

async function main() {
  const t0 = Date.now();
  console.log(`${COLOR.bold}Teste end-to-end da arquitetura v2 — bolão${COLOR.reset}`);
  console.log(`${COLOR.gray}data: ${new Date().toISOString()}${COLOR.reset}`);

  try {
    await testEnvsAndDb();

    const provider = await testProvider();
    if (provider) {
      await testPersistence(provider);
      await testDedupe(provider);
      await testOrchestrator();
    } else {
      skip("provider", "demais testes que dependem do provider", "provider falhou");
    }

    await testRealtimeWorkerQuery();
    await testExtrasRodada();
  } finally {
    await cleanupMocks().catch((err) => console.warn("cleanup:", err));
    section("Cleanup");
    console.log(`  ${COLOR.green}✓${COLOR.reset} mocks removidos (competition_id = ${MOCK_COMP_ID})`);
  }

  // Relatorio
  section("RELATÓRIO");
  const total = results.length;
  const passes = results.filter((r) => r.status === "PASS").length;
  const fails = results.filter((r) => r.status === "FAIL").length;
  const skips = results.filter((r) => r.status === "SKIP").length;
  console.log(
    `  total: ${total} | ${COLOR.green}PASS ${passes}${COLOR.reset} | ${COLOR.red}FAIL ${fails}${COLOR.reset} | ${COLOR.yellow}SKIP ${skips}${COLOR.reset}`,
  );
  if (fails > 0) {
    console.log(`\n  ${COLOR.red}${COLOR.bold}FAILURES:${COLOR.reset}`);
    for (const r of results.filter((r) => r.status === "FAIL")) {
      console.log(`    ${COLOR.red}✗${COLOR.reset} [${r.section}] ${r.name}: ${r.detail}`);
    }
  }

  console.log(`\n  ${COLOR.gray}duracao: ${((Date.now() - t0) / 1000).toFixed(1)}s${COLOR.reset}`);
  await getPool().end().catch(() => {});
  process.exit(fails > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\n[fatal]", err);
  process.exit(2);
});
