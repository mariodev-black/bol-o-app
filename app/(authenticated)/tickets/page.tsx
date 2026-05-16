import { getAppServerConfig } from "@/lib/app-server-config";
import { TicketsPageClient } from "./TicketsPageClient";

export const dynamic = "force-dynamic";

function parseEnvBool(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

export default function TicketsPage() {
  const { extraChampionshipIds, copaBonusPromo } = getAppServerConfig();
  const ticketsExtraOnly = parseEnvBool(process.env.TICKETS_EXTRA_ONLY);
  return (
    <TicketsPageClient
      serverExtraChampionshipIds={extraChampionshipIds}
      serverCopaBonusPromo={copaBonusPromo}
      ticketsExtraOnly={ticketsExtraOnly}
    />
  );
}
