import { NextRequest } from "next/server";
import { requireSessionUserId } from "@/lib/auth/session-user";
import { getWalletBalanceCents } from "@/lib/wallet/ledger";
import { subscribeWalletBalance } from "@/lib/wallet/wallet-events";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (!userId) {
    return new Response("Nao autenticado", { status: 401 });
  }

  const encoder = new TextEncoder();
  const initial = await getWalletBalanceCents(userId);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (balanceCents: number) => {
        controller.enqueue(
          encoder.encode(`event: balance\ndata: ${JSON.stringify({ balanceCents })}\n\n`)
        );
      };

      // Estado inicial (one-shot, sem polling).
      send(initial);

      const unsubscribe = await subscribeWalletBalance(userId, send);

      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
      }, 15000);

      request.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
