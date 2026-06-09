/**
 * Simula pagamento + valida bolão diário na conta mario@gmail.com.
 * Run: npx tsx --tsconfig tsconfig.scripts.json scripts/complete-mario-daily-test.ts
 */
import "dotenv/config";
import { getPool } from "@/lib/db";
import {
  dailyEditionLabel,
  formatDailyEditionDatesLabel,
  getDailyEdition,
  getDailyEditionDatesSet,
  paidTicketDailyEditionNumber,
} from "@/lib/boloes/daily-editions";
import { scopeMatchesForPaidTicket } from "@/lib/boloes/ticket-match-scope";
import { getFootballMainCompetitionId } from "@/lib/boloes-extra-config";
import { fetchMatchesMap } from "@/lib/football-api";

const EMAIL = "mario@gmail.com";
const TX_ID = "3e02346b-3eca-4153-8c40-4963133e8fe2";
const TICKET_ID = "8c5851de-f57f-40cf-831e-8cfb09f9c259";
const PROVIDER_TX_ID = "a7aabfc3-41c6-4625-ada3-1d49da9801cb";
const APP_URL = (process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");

async function simulatePaidWebhook(): Promise<void> {
  const response = await fetch(`${APP_URL}/api/webhooks/skale`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: PROVIDER_TX_ID,
      status: "paid",
      end2EndId: `E_MARIO_TEST_${Date.now()}`,
    }),
  });
  const body = await response.json().catch(() => ({}));
  console.log("\n=== Webhook simulado ===");
  console.log(JSON.stringify({ status: response.status, body }, null, 2));
  if (!response.ok) throw new Error("Webhook falhou");
}

async function main() {
  const pool = getPool();

  const { rows: users } = await pool.query<{ id: string; email: string }>(
    "SELECT id, email FROM users WHERE lower(trim(email)) = lower(trim($1)) LIMIT 1",
    [EMAIL],
  );
  const mario = users[0];
  if (!mario) {
    throw new Error(`Usuário ${EMAIL} não encontrado`);
  }
  console.log(`\n=== Usuário ===\n${mario.email} · ${mario.id}`);

  const { rows: txRows } = await pool.query<{
    id: string;
    status: string;
    user_id: string;
    ticket_id: string;
    provider_transaction_id: string;
  }>(
    `SELECT id, status, user_id, ticket_id, provider_transaction_id
     FROM transactions WHERE id = $1`,
    [TX_ID],
  );
  const tx = txRows[0];
  if (!tx) throw new Error(`Transação ${TX_ID} não encontrada`);

  const { rows: tkRows } = await pool.query<{
    id: string;
    user_id: string;
    ticket_type: string;
    round_number: number | null;
    status: string;
    transaction_id: string | null;
    paid_at: Date | null;
  }>(
    `SELECT id, user_id, ticket_type, round_number, status, transaction_id, paid_at
     FROM tickets WHERE id = $1`,
    [TICKET_ID],
  );
  const ticket = tkRows[0];
  if (!ticket) throw new Error(`Ticket ${TICKET_ID} não encontrado`);

  console.log("\n=== Antes dos ajustes ===");
  console.log("transaction:", tx);
  console.log("ticket:", ticket);

  // Garante vínculo com mario@gmail.com
  if (tx.user_id !== mario.id) {
    await pool.query("UPDATE transactions SET user_id = $1, updated_at = now() WHERE id = $2", [
      mario.id,
      TX_ID,
    ]);
    console.log("\n[FIX] transaction.user_id → mario");
  }
  if (ticket.user_id !== mario.id) {
    await pool.query("UPDATE tickets SET user_id = $1, updated_at = now() WHERE id = $2", [
      mario.id,
      TICKET_ID,
    ]);
    console.log("[FIX] ticket.user_id → mario");
  }
  if (ticket.transaction_id !== TX_ID) {
    await pool.query(
      "UPDATE tickets SET transaction_id = $1, updated_at = now() WHERE id = $2",
      [TX_ID, TICKET_ID],
    );
    console.log("[FIX] ticket.transaction_id → transação");
  }

  // Edição #1 (11, 12, 13 jun) — loja atual
  const editionNumber = ticket.round_number && ticket.round_number > 0 ? ticket.round_number : 1;
  if (ticket.round_number !== editionNumber) {
    await pool.query("UPDATE tickets SET round_number = $1, updated_at = now() WHERE id = $2", [
      editionNumber,
      TICKET_ID,
    ]);
    console.log(`[FIX] ticket.round_number → ${editionNumber}`);
  }

  if (tx.status !== "paid") {
    await simulatePaidWebhook();
  } else {
    console.log("\n=== Pagamento ===\nTransação já está paid — pulando webhook.");
  }

  const { rows: finalTx } = await pool.query(
    "SELECT status, user_id FROM transactions WHERE id = $1",
    [TX_ID],
  );
  const { rows: finalTk } = await pool.query(
    "SELECT status, paid_at, round_number, user_id, ticket_type FROM tickets WHERE id = $1",
    [TICKET_ID],
  );

  console.log("\n=== Depois do pagamento ===");
  console.log("transaction:", finalTx[0]);
  console.log("ticket:", finalTk[0]);

  if (finalTx[0]?.status !== "paid" || finalTk[0]?.status !== "paid") {
    throw new Error("Pagamento não confirmou ticket/transação");
  }
  if (finalTk[0]?.user_id !== mario.id) {
    throw new Error("Ticket não pertence a mario@gmail.com");
  }

  const edition = paidTicketDailyEditionNumber({
    ticketType: "daily",
    round_number: finalTk[0]?.round_number,
  });
  if (edition == null) throw new Error("round_number inválido no ticket daily");

  const dateSet = getDailyEditionDatesSet(edition);
  const matchMap = await fetchMatchesMap({
    ensureCompetitionIds: [getFootballMainCompetitionId()],
  }).catch(() => new Map());

  const scoped = scopeMatchesForPaidTicket(
    {
      id: TICKET_ID,
      ticketType: "daily",
      quantity: 1,
      paidAt: finalTk[0]?.paid_at?.toISOString() ?? null,
      createdAt: new Date().toISOString(),
      dailyEditionNumber: edition,
    },
    matchMap,
  );

  const editionMeta = getDailyEdition(edition)!;
  console.log(
    `\n=== Palpites — ${dailyEditionLabel(edition)} · ${formatDailyEditionDatesLabel(editionMeta)} ===`,
  );
  console.log(`Datas da edição: ${[...dateSet].join(", ")}`);
  console.log(`Jogos no escopo: ${scoped.length}`);
  for (const m of scoped) {
    console.log(`  · ${m.dateBR} ${m.hour ?? ""} — ${m.home} x ${m.away}`);
  }

  const bad = scoped.filter((m) => !m.dateBR || !dateSet.has(m.dateBR));
  if (bad.length > 0) {
    throw new Error(`${bad.length} jogos fora das datas da edição`);
  }

  const byDate = [...dateSet].map((d) => ({
    date: d,
    count: scoped.filter((m) => m.dateBR === d).length,
  }));
  console.log("\nJogos por dia:", byDate);

  console.log("\n=== Pronto para testar no app ===");
  console.log(`Conta: ${EMAIL}`);
  console.log(`Ticket: ${TICKET_ID}`);
  console.log(`URL: ${APP_URL}/palpites?ticket=${TICKET_ID}`);
  console.log(`Bolões: ${APP_URL}/boloes`);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
