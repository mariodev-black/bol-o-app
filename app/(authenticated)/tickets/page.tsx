import { TicketsPageClient } from "./TicketsPageClient";

export const dynamic = "force-dynamic";

/** Loja principal completa: Milhão, Diário e Artilheiros. */
export default function TicketsPage() {
  return <TicketsPageClient ticketsHideExtra />;
}
