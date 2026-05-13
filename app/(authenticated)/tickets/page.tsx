import { parseExtraBolaoChampionshipIds } from "@/lib/boloes-extra-config";
import { TicketsPageClient } from "./TicketsPageClient";

export const dynamic = "force-dynamic";

function parseEnvBool(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

export default function TicketsPage() {
  const serverExtraChampionshipIds = parseExtraBolaoChampionshipIds();
  const ticketsExtraOnly = parseEnvBool(process.env.TICKETS_EXTRA_ONLY);
  return (
    <TicketsPageClient
      serverExtraChampionshipIds={serverExtraChampionshipIds}
      ticketsExtraOnly={ticketsExtraOnly}
    />
  );
}
