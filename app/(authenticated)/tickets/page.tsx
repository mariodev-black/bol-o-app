import { parseExtraBolaoChampionshipIds } from "@/lib/boloes-extra-config";
import { TicketsPageClient } from "./TicketsPageClient";

export const dynamic = "force-dynamic";

export default function TicketsPage() {
  const serverExtraChampionshipIds = parseExtraBolaoChampionshipIds();
  return <TicketsPageClient serverExtraChampionshipIds={serverExtraChampionshipIds} />;
}
