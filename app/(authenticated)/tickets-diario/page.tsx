import { TicketsPageClient } from "../tickets/TicketsPageClient";

export const dynamic = "force-dynamic";

/** Checkout dedicado: somente Bolão Diário (Copa). */
export default function TicketsDiarioPage() {
  return <TicketsPageClient ticketsDailyOnly />;
}
