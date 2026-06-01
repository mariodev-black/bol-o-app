/**
 * Top 100 do ranking extra por campeonato + rodada (mesma lógica do app).
 *
 *   npm run rank:extra-top100
 *   npm run rank:extra-top100 -- --limit=50
 *   npm run rank:extra-top100 -- --pool=10:18 --pool=7:6
 *
 * Pools padrão (Brasileirão 18ª + Libertadores 6ª) vêm de
 * `EXTRA_GIFT_PROMO_ROUNDS` / defaults em `extra-gift.ts`, validados no cache.
 */
import { config as dotenvConfig } from "dotenv";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

dotenvConfig({ path: ".env" });

import { getPool } from "../lib/db";
import {
  buildLeaderboardExtraForCompAndRound,
  type LeaderboardRow,
} from "../lib/ranking/leaderboard";
import { isRankingFillerRow } from "../lib/ranking/ranking-bots";
import { resolveExtraBolaoDisplayName } from "../lib/boloes-extra-competition-branding";
import {
  isBrasileiraoExtraChampionship,
  isLibertadoresExtraChampionship,
} from "../lib/boloes-extra-competition-branding";
import { listMatchesForExtraRound } from "../lib/football/extras-rodada";
import { readChampionshipSnapshot } from "../lib/football/persistence";
/** Rodadas alvo para exportação (Brasileirão 18ª + Libertadores 6ª). */
const DEFAULT_EXPORT_POOLS: ReadonlyArray<{ competitionId: number; rodada: number }> = [
  { competitionId: 10, rodada: 18 },
  { competitionId: 7, rodada: 6 },
];

function parseRoundsFromEnv(): Map<number, number> {
  const map = new Map(DEFAULT_EXPORT_POOLS.map((p) => [p.competitionId, p.rodada]));
  const raw = process.env.EXTRA_GIFT_PROMO_ROUNDS?.trim();
  if (!raw) return map;
  for (const part of raw.split(/[,;\s]+/)) {
    const chunk = part.trim();
    if (!chunk) continue;
    const [idStr, roundStr] = chunk.split(/[:=]/);
    const id = Number.parseInt(idStr?.trim() ?? "", 10);
    const rodada = Number.parseInt(roundStr?.trim() ?? "", 10);
    if (Number.isFinite(id) && id > 0 && Number.isFinite(rodada) && rodada > 0) {
      map.set(id, rodada);
    }
  }
  return map;
}

type ExtraPool = {
  label: string;
  competitionId: number;
  rodada: number;
  championshipName: string;
};

function parsePoolArg(raw: string): ExtraPool | null {
  const [idStr, rodStr] = raw.split(":");
  const competitionId = Number.parseInt(idStr?.trim() ?? "", 10);
  const rodada = Number.parseInt(rodStr?.trim() ?? "", 10);
  if (!Number.isFinite(competitionId) || !Number.isFinite(rodada) || rodada < 1) {
    return null;
  }
  return {
    label: "",
    competitionId,
    rodada,
    championshipName: resolveExtraBolaoDisplayName(competitionId, null),
  };
}

function defaultPoolsFromEnv(): ExtraPool[] {
  const rounds = parseRoundsFromEnv();
  return DEFAULT_EXPORT_POOLS.map(({ competitionId }) => ({
    label: "",
    competitionId,
    rodada: rounds.get(competitionId) ?? DEFAULT_EXPORT_POOLS.find((p) => p.competitionId === competitionId)!.rodada,
    championshipName: resolveExtraBolaoDisplayName(competitionId, null),
  }));
}

function parseArgs(): { pools: ExtraPool[]; limit: number; outDir: string | null } {
  const pools: ExtraPool[] = [];
  let limit = 100;
  let outDir: string | null = null;

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--pool=")) {
      const p = parsePoolArg(arg.slice("--pool=".length));
      if (!p) throw new Error(`Pool inválido "${arg}" — use compId:rodada (ex.: 10:18)`);
      pools.push(p);
    } else if (arg.startsWith("--brasileirao=")) {
      const p = parsePoolArg(arg.slice("--brasileirao=".length));
      if (p) pools.push(p);
    } else if (arg.startsWith("--libertadores=")) {
      const p = parsePoolArg(arg.slice("--libertadores=".length));
      if (p) pools.push(p);
    } else if (arg.startsWith("--limit=")) {
      limit = Math.min(500, Math.max(1, Number.parseInt(arg.slice("--limit=".length), 10) || 100));
    } else if (arg.startsWith("--out=")) {
      outDir = arg.slice("--out=".length).trim() || null;
    }
  }

  const resolved = pools.length > 0 ? pools : defaultPoolsFromEnv();
  return { pools: resolved, limit, outDir };
}

async function enrichPoolLabels(pool: ExtraPool): Promise<ExtraPool> {
  const snap = await readChampionshipSnapshot(pool.competitionId);
  const name =
    snap?.nome?.trim() ||
    resolveExtraBolaoDisplayName(pool.competitionId, null);
  const rodadaLabel = `${pool.rodada}ª Rodada`;
  let kind = "Extra";
  if (isBrasileiraoExtraChampionship(pool.competitionId, name)) kind = "Brasileirão";
  else if (isLibertadoresExtraChampionship(pool.competitionId, name)) kind = "Libertadores";

  return {
    ...pool,
    championshipName: name,
    label: `${kind} — ${rodadaLabel}`,
  };
}

async function loadEmails(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;
  const pool = getPool();
  const { rows } = await pool.query<{ id: string; email: string }>(
    `SELECT id::text AS id, email FROM users WHERE id::text = ANY($1::text[])`,
    [userIds],
  );
  for (const r of rows) map.set(r.id, r.email);
  return map;
}

type PoolCohortStats = {
  paidTickets: number;
  promoTickets: number;
  withPoints: number;
};

async function loadPoolCohortStats(
  competitionId: number,
  cohortTicketIds: string[],
): Promise<PoolCohortStats> {
  if (cohortTicketIds.length === 0) {
    return { paidTickets: 0, promoTickets: 0, withPoints: 0 };
  }
  const pool = getPool();
  const { rows } = await pool.query<{
    paid_tickets: string;
    promo_tickets: string;
  }>(
    `SELECT
       COUNT(*) FILTER (
         WHERE NOT COALESCE(is_promo_bonus, false)
           AND COALESCE(NULLIF(total_amount_cents, 0), unit_price_cents * quantity, 0) > 0
       )::text AS paid_tickets,
       COUNT(*) FILTER (WHERE COALESCE(is_promo_bonus, false))::text AS promo_tickets
     FROM tickets
     WHERE id::text = ANY($1::text[])`,
    [cohortTicketIds],
  );
  const row = rows[0];
  return {
    paidTickets: Number(row?.paid_tickets ?? 0),
    promoTickets: Number(row?.promo_tickets ?? 0),
    withPoints: 0,
  };
}

function formatBrlCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function csvEscape(v: string | number): string {
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(
  rows: Array<LeaderboardRow & { email: string; campeonato: string; rodada: number }>,
): string {
  const header =
    "posicao,campeonato,rodada,nome,email,user_id,ticket_id,pontos,placares_exatos,acertos_resultado,gols_time,premio_sequencia";
  const lines = rows.map((r) =>
    [
      r.pos,
      r.campeonato,
      r.rodada,
      r.displayName,
      r.email,
      r.userId,
      r.ticketId,
      r.totalPoints,
      r.exactCount,
      r.outcomeCount,
      r.goalsCount,
      r.bestStreak,
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header, ...lines].join("\n");
}

async function printPoolRanking(pool: ExtraPool, limit: number, outDir: string | null) {
  const poolEnriched = await enrichPoolLabels(pool);
  const roundMatches = await listMatchesForExtraRound(
    poolEnriched.competitionId,
    poolEnriched.rodada,
  );

  console.log("\n" + "=".repeat(72));
  console.log(poolEnriched.label);
  console.log(
    `Campeonato: ${poolEnriched.championshipName} (API id ${poolEnriched.competitionId}) · Rodada ${poolEnriched.rodada}`,
  );
  console.log(`Jogos no cache desta rodada: ${roundMatches.length}`);
  if (roundMatches.length === 0) {
    console.warn(
      "⚠ Nenhuma partida em matches_cache para este campeonato/rodada — confira sync e o número da rodada.",
    );
  }
  console.log("Palpites: só cotas deste campeonato + jogos desta rodada (matches_cache)");
  console.log("Ordenação: pontos → exato → acerto → gols → sequência → envio mais cedo");
  console.log("=".repeat(72));

  const t0 = Date.now();
  const { rows: allRows, meta } = await buildLeaderboardExtraForCompAndRound(
    poolEnriched.competitionId,
    poolEnriched.rodada,
  );
  console.log(`Calculado em ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const realRows = allRows.filter((r) => !isRankingFillerRow(r));
  const cohortTicketIds = realRows.map((r) => r.ticketId);
  const cohortStats = await loadPoolCohortStats(poolEnriched.competitionId, cohortTicketIds);
  const withPoints = realRows.filter((r) => r.totalPoints > 0).length;
  cohortStats.withPoints = withPoints;

  const top = realRows.slice(0, limit);
  const emails = await loadEmails(top.map((r) => r.userId));
  const enriched = top.map((r) => ({
    ...r,
    email: emails.get(r.userId) ?? "",
    campeonato: poolEnriched.championshipName,
    rodada: poolEnriched.rodada,
  }));

  console.log("\n--- Resumo do pool ---");
  console.log(`Cotas no ranking (rodada ${poolEnriched.rodada}): ${meta.participantCount}`);
  console.log(`  · Pagas (PIX): ${cohortStats.paidTickets}`);
  console.log(`  · Grátis (promo/brinde): ${cohortStats.promoTickets}`);
  console.log(`  · Com pontos > 0: ${withPoints}`);
  console.log(`Arrecadação cotas pagas: ${formatBrlCents(meta.revenueCents)}`);
  console.log(`Premiação estimada (~60% do arrecadado): ${formatBrlCents(meta.poolCentsApprox)}`);
  console.log(`Top ${limit} exibidos de ${realRows.length} classificados`);

  console.log("\n--- Top " + limit + " ---\n");
  console.log(
    "Pos".padEnd(5) +
      "Pontos".padEnd(7) +
      "Exatos".padEnd(8) +
      "Acertos".padEnd(9) +
      "Nome".padEnd(28) +
      "E-mail",
  );
  console.log("-".repeat(90));

  for (const r of enriched) {
    console.log(
      String(r.pos).padEnd(5) +
        String(r.totalPoints).padEnd(7) +
        String(r.exactCount).padEnd(8) +
        String(r.outcomeCount).padEnd(9) +
        r.displayName.slice(0, 26).padEnd(28) +
        r.email,
    );
  }

  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    const safeName = poolEnriched.label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
    const csvPath = join(
      outDir,
      `extra-ranking-top${limit}-comp${poolEnriched.competitionId}-r${poolEnriched.rodada}-${safeName}.csv`,
    );
    writeFileSync(csvPath, rowsToCsv(enriched), "utf8");
    console.log(`\nCSV salvo: ${csvPath}`);
  }

  return { pool: poolEnriched, meta, enriched, totalRanked: realRows.length, cohortStats, withPoints };
}

async function main() {
  const { pools, limit, outDir } = parseArgs();

  console.log("Ranking extra — exportação Top", limit);
  console.log(
    "Pools:",
    pools.map((p) => `${p.championshipName || "comp"} ${p.competitionId}:${p.rodada}`).join(" | "),
  );

  const summaries: Array<{
    label: string;
    participants: number;
    paid: number;
    promo: number;
    withPoints: number;
    topListed: number;
    winner: string;
    winnerPoints: number;
    revenue: string;
  }> = [];

  for (const pool of pools) {
    const result = await printPoolRanking(pool, limit, outDir);
    const first = result.enriched[0];
    summaries.push({
      label: result.pool.label,
      participants: result.meta.participantCount,
      paid: result.cohortStats.paidTickets,
      promo: result.cohortStats.promoTickets,
      withPoints: result.withPoints,
      topListed: result.enriched.length,
      winner: first ? `${first.displayName} <${first.email}>` : "—",
      winnerPoints: first?.totalPoints ?? 0,
      revenue: formatBrlCents(result.meta.revenueCents),
    });
  }

  console.log("\n" + "=".repeat(72));
  console.log("RESUMO FINAL");
  console.log("=".repeat(72));
  for (const s of summaries) {
    console.log(`\n${s.label}`);
    console.log(`  Cotas na rodada: ${s.participants} (${s.paid} pagas · ${s.promo} grátis · ${s.withPoints} com pontos)`);
    console.log(`  Arrecadação: ${s.revenue}`);
    console.log(`  Top listados: ${s.topListed}`);
    console.log(`  1º: ${s.winner} — ${s.winnerPoints} pts`);
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error("[rank:extra-top100] falhou", e);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      /* ignore */
    }
  });
