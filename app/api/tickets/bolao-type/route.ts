import { NextResponse } from "next/server";
import { inferBolaoTypeFromTicketId } from "@/lib/ticket-kind-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ticketId = url.searchParams.get("ticketId")?.trim() ?? "";
  const t = await inferBolaoTypeFromTicketId(ticketId);
  return NextResponse.json({ bolaoType: t ?? "principal" });
}
