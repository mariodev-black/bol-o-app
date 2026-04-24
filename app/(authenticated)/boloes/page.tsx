import { cookies } from "next/headers";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { listPaidTicketsForUser } from "@/lib/payments/user-tickets";
import {
  type StoredTicket,
} from "@/app/(authenticated)/tickets/lib/ownedTicketsStorage";
import { BoloesClient } from "@/app/(authenticated)/boloes/BoloesClient";

async function loadServerTickets(): Promise<StoredTicket[]> {
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (!token) return [];
  const userId = await verifySessionToken(token).catch(() => null);
  if (!userId) return [];
  const paid = await listPaidTicketsForUser(userId);
  return paid.map((t) => {
    const createdAt = t.paidAt ? new Date(t.paidAt).getTime() : new Date(t.createdAt).getTime();
    if (t.ticketType === "daily") return { id: t.id, kind: "diario", createdAt, playDate: null } as const;
    return { id: t.id, kind: "geral", createdAt } as const;
  });
}

export default async function BoloesPage() {
  const tickets = await loadServerTickets();
  return <BoloesClient tickets={tickets} />;
}
