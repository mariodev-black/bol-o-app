import { TicketsPageClient } from "./TicketsPageClient";

export const dynamic = "force-dynamic";

/** Loja principal: somente Bolão do Milhão + edições do Bolão Diário. */
export default function TicketsPage() {
  return <TicketsPageClient ticketsPrincipalAndDailyOnly />;
}
