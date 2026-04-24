import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/session-user";
import { listPaidTicketsForUser } from "@/lib/payments/user-tickets";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = await requireSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }
  const tickets = await listPaidTicketsForUser(userId);
  return NextResponse.json({ tickets });
}
