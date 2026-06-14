/**
 * Adiciona palpites recebidos por WhatsApp no bolão Skale (comp 90007),
 * partida México x África do Sul (match_id 27368).
 *
 * Uso:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/add-whatsapp-palpites.ts          (DRY-RUN)
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/add-whatsapp-palpites.ts --commit (ESCREVE)
 *
 * Ranking: pontuação é derivada dos palpites + resultado da partida (sem coluna de pontos),
 * então o ranking do bolão reflete automaticamente após o TTL de cache (~12s).
 */
import "dotenv/config";
import { getPool } from "../lib/db";
import { upsertPrediction } from "../lib/predictions";

const MATCH_ID = 27368; // México x África do Sul
const SKALE_COMP = 90007;
const HOME = "México";
const AWAY = "África do Sul";

type Entry = { email: string; casa: number; visitante: number };

const ENTRIES: Entry[] = [
  { email: "helioneto709@gmail.com", casa: 2, visitante: 1 },
  // screenshot trazia "gabriellalla08" (typo); conta real é "gabrielalla08" (Gabriel Godoy Alla), tem ticket Skale.
  { email: "gabrielalla08@gmail.com", casa: 1, visitante: 0 },
  { email: "cidamiguelbr2016@gmail.com", casa: 1, visitante: 0 },
];

async function main() {
  const commit = process.argv.includes("--commit");
  const pool = getPool();

  // valida a partida
  const m = await pool.query<{
    match_id: number;
    home_name: string;
    away_name: string;
    status: string;
    result_casa: number | null;
    result_visitante: number | null;
  }>(
    `SELECT match_id, home_name, away_name, status, result_casa, result_visitante
       FROM matches_cache WHERE competition_id = $1 AND match_id = $2 LIMIT 1`,
    [SKALE_COMP, MATCH_ID],
  );
  if (!m.rows[0]) {
    console.error(`!! match ${MATCH_ID} não existe na comp ${SKALE_COMP}`);
    process.exit(1);
  }
  const match = m.rows[0];
  console.log(
    `Partida: ${match.home_name} x ${match.away_name} (match ${MATCH_ID}, comp ${SKALE_COMP}) — status=${match.status} resultado=${match.result_casa ?? "-"}x${match.result_visitante ?? "-"}\n`,
  );
  console.log(commit ? ">>> MODO COMMIT (vai escrever)\n" : ">>> DRY-RUN (nada será escrito)\n");

  let ok = 0;
  let skipped = 0;

  for (const e of ENTRIES) {
    const u = await pool.query<{ id: string; name: string | null }>(
      `SELECT id::text AS id, name FROM users WHERE lower(email) = lower($1) LIMIT 1`,
      [e.email],
    );
    const user = u.rows[0];
    if (!user) {
      console.log(`SKIP  ${e.email} → usuário não cadastrado`);
      skipped++;
      continue;
    }

    const t = await pool.query<{ id: string }>(
      `SELECT id::text AS id FROM tickets
        WHERE user_id::text = $1 AND ticket_type = 'extra'
          AND extra_championship_id = $2 AND status IN ('paid','approved')
        ORDER BY created_at ASC NULLS LAST LIMIT 1`,
      [user.id, SKALE_COMP],
    );
    const ticket = t.rows[0];
    if (!ticket) {
      console.log(`SKIP  ${e.email} (${user.name ?? ""}) → sem ticket pago no Skale (${SKALE_COMP})`);
      skipped++;
      continue;
    }

    console.log(
      `${commit ? "WRITE" : "PLAN "} ${e.email} (${user.name ?? ""}) → ${HOME} ${e.casa}x${e.visitante} ${AWAY} | ticket=${ticket.id}`,
    );

    if (commit) {
      await upsertPrediction({
        userId: user.id,
        ticketId: ticket.id,
        bolaoType: "extra",
        matchId: MATCH_ID,
        scoreCasa: e.casa,
        scoreVisitante: e.visitante,
      });
      ok++;
    } else {
      ok++;
    }
  }

  console.log(`\n${commit ? "Gravados" : "Seriam gravados"}: ${ok} | Pulados: ${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
