import { TicketsPageClient } from "./TicketsPageClient";

export const dynamic = "force-dynamic";

export default function TicketsPage() {
  return (
    <TicketsPageClient ticketsPrincipalOnly />
  );
}
