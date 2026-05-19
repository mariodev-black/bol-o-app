import { getAppServerConfig } from "@/lib/app-server-config";
import { getTicketShopFlags } from "@/lib/ticket-shop-flags";
import { TicketsPageClient } from "./TicketsPageClient";

export const dynamic = "force-dynamic";

export default function TicketsPage() {
  const { extraChampionshipIds } = getAppServerConfig();
  const { ticketsExtraOnly, ticketsHideDaily } = getTicketShopFlags();
  return (
    <TicketsPageClient
      serverExtraChampionshipIds={extraChampionshipIds}
      ticketsExtraOnly={ticketsExtraOnly}
      ticketsHideDaily={ticketsHideDaily}
    />
  );
}
