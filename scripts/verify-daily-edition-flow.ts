/**
 * Verifica loja + escopo de jogos do bolão diário por edição.
 * Run: npx tsx --tsconfig tsconfig.scripts.json scripts/verify-daily-edition-flow.ts
 */
import { randomUUID } from "crypto";
import { getPool } from "@/lib/db";
import {
  formatDailyEditionDatesLabel,
  getDailyEdition,
  getDailyEditionDatesSet,
  resolveShopDailyEdition,
  resolveDailyEditionStatus,
} from "@/lib/boloes/daily-editions";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { scopeMatchesForPaidTicket } from "@/lib/boloes/ticket-match-scope";
import { fetchMatchesMap } from "@/lib/football-api";
import { dailyEditionLabel, listGroupStageDailyEditions } from "@/lib/boloes/daily-editions";

async function main() {
  const mainComp = getFootballMainCompetitionId();
  const matchMap = await fetchMatchesMap({ ensureCompetitionIds: [mainComp] }).catch(
    () => new Map(),
  );

  const catalog = listGroupStageDailyEditions().map((edition) => ({
    number: edition.number,
    label: dailyEditionLabel(edition.number),
    datesLabel: formatDailyEditionDatesLabel(edition),
    datesBR: edition.datesBR,
    status: resolveDailyEditionStatus(edition.number, matchMap, mainComp),
    purchaseOpen: resolveDailyEditionStatus(edition.number, matchMap, mainComp) !== "encerrado",
  }));

  const shopEdition = resolveShopDailyEdition(catalog);
  console.log("\n=== Loja (/tickets) — edição exibida ===");
  if (!shopEdition) {
    console.log("Nenhuma edição aberta para compra.");
  } else {
    console.log(`${shopEdition.label} · ${shopEdition.datesLabel}`);
    console.log(`Status: ${shopEdition.status}`);
    console.log(`Datas: ${shopEdition.datesBR.join(", ")}`);
  }

  const editionToTest = shopEdition?.number ?? 1;
  const editionMeta = getDailyEdition(editionToTest)!;
  const dateSet = getDailyEditionDatesSet(editionToTest);

  const scoped = scopeMatchesForPaidTicket(
    {
      id: "sim-ticket",
      ticketType: "daily",
      quantity: 1,
      paidAt: null,
      createdAt: new Date().toISOString(),
      dailyEditionNumber: editionToTest,
    },
    matchMap,
  );

  console.log(`\n=== Palpites — ${dailyEditionLabel(editionToTest)} ===`);
  console.log(`Datas da edição: ${[...dateSet].join(", ")}`);
  console.log(`Jogos no escopo (matches_cache): ${scoped.length}`);
  for (const m of scoped.slice(0, 8)) {
    console.log(`  · ${m.dateBR} ${m.hour ?? ""} — ${m.home} x ${m.away}`);
  }
  if (scoped.length > 8) console.log(`  … +${scoped.length - 8} jogos`);

  const outOfScope = scoped.filter((m) => !m.dateBR || !dateSet.has(m.dateBR));
  if (outOfScope.length > 0) {
    console.error("\n[FALHA] Jogos fora das datas da edição:", outOfScope.length);
    process.exit(1);
  }

  const editionDatesWithMatches = editionMeta.datesBR.filter((d) =>
    scoped.some((m) => m.dateBR === d),
  );
  console.log(`\nDias da edição com jogos no cache: ${editionDatesWithMatches.join(", ") || "(nenhum)"}`);
  if (scoped.length === 0) {
    console.warn(
      "\n[AVISO] Sem jogos no cache para esta edição — sincronize a Copa ou aguarde calendário.",
    );
  } else {
    console.log("\n[OK] Escopo do bolão diário restrito às datas da edição.");
  }

  const pool = getPool();
  const ref = `verify_daily_${randomUUID()}`;
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO tickets (
       user_id, ticket_type, round_number, unit_price_cents, quantity,
       total_amount_cents, status, external_ref
     )
     SELECT id, 'daily', $1, 2000, 1, 2000, 'paid', $2
     FROM users
     ORDER BY created_at ASC
     LIMIT 1
     RETURNING id::text AS id`,
    [editionToTest, ref],
  );
  const ticketId = rows[0]?.id;
  if (ticketId) {
    console.log(`\n=== Simulação de compra ===`);
    console.log(`Ticket simulado: ${ticketId}`);
    console.log(`round_number (edição): ${editionToTest}`);
    await pool.query("DELETE FROM tickets WHERE id::text = $1", [ticketId]);
    console.log("[OK] Ticket de teste removido (rollback).");
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
