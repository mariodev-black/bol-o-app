import "dotenv/config";
import { listAdminTicketScopePredictions } from "../lib/admin/ticket-scope-predictions";

async function main() {
  const tickets = [
    "feb7c970-f59a-4004-bf5b-f9474642c801",
    "18e28026-0ced-4640-9c2b-2dabefd92426",
    "0c0478d5-12f7-45cf-8d4d-e8408f48da5c",
  ];

  for (const id of tickets) {
    const data = await listAdminTicketScopePredictions(id);
    const bad = data?.items?.filter((i) => !Number.isFinite(i.matchId) || i.matchId <= 0) ?? [];
    console.log(id, {
      total: data?.totalMatchesCount,
      preds: data?.predictionsCount,
      bad: bad.length,
      first: data?.items?.[0],
    });
  }
}

main().catch(console.error);
