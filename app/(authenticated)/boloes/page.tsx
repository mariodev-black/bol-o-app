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
  const mapped = paid.map((t) => {
    const createdAt = t.paidAt ? new Date(t.paidAt).getTime() : new Date(t.createdAt).getTime();
    if (t.ticketType === "daily") {
      return {
        id: t.id,
        kind: "diario",
        createdAt,
        playDate: t.playDate ?? null,
        dailyStatus: t.dailyStatus ?? "disponivel",
        availableGames: Math.max(0, Number(t.availableGames ?? 0)),
      } as const;
    }
    return { id: t.id, kind: "geral", createdAt, availableGames: Math.max(0, Number(t.availableGames ?? 0)) } as const;
  });
  console.log(
    "[boloes/page] loadServerTickets",
    mapped.map((t) => ({
      id: t.id,
      kind: t.kind,
      playDate: t.kind === "diario" ? t.playDate : undefined,
      dailyStatus: t.kind === "diario" ? t.dailyStatus : undefined,
      availableGames: t.availableGames ?? 0,
    })),
  );
  return mapped;
}

export default async function BoloesPage() {
  const tickets = await loadServerTickets();
  return <BoloesClient tickets={tickets} />;
}
