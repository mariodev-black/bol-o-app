import { getAppServerConfig } from "@/lib/app-server-config";
import { getTicketShopFlags } from "@/lib/ticket-shop-flags";
import { TicketsPageClient } from "./TicketsPageClient";

export const dynamic = "force-dynamic";

export default function TicketsPage() {
  const { extraChampionshipIds, copaBonusPromo } = getAppServerConfig();
  const { ticketsExtraOnly, ticketsHideDaily } = getTicketShopFlags();
  return (
    <TicketsPageClient
      serverExtraChampionshipIds={extraChampionshipIds}
      serverCopaBonusPromo={copaBonusPromo}
      ticketsExtraOnly={ticketsExtraOnly}
      ticketsHideDaily={ticketsHideDaily}
    />
  );
}
