import { NextRequest } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { getDepositTransactionById } from "@/lib/payments/transactions";
import { subscribeTransactionEvent } from "@/lib/payments/transaction-events";

export const runtime = "nodejs";

async function authUserId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(sessionCookieName())?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await authUserId(request);
  if (!userId) {
    return new Response("Nao autenticado", { status: 401 });
  }

  const { id } = await context.params;
  const transaction = await getDepositTransactionById(userId, id);
  if (!transaction) {
    return new Response("Transacao nao encontrada", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `event: transaction\n` +
            `data: ${JSON.stringify({
              transactionId: transaction.id,
              status: transaction.status,
              pixQrcode: transaction.pixQrcode,
              providerTransactionId: transaction.providerTransactionId,
            })}\n\n`
        )
      );

      const unsubscribe = subscribeTransactionEvent(id, (payload) => {
        controller.enqueue(encoder.encode(`event: transaction\ndata: ${JSON.stringify(payload)}\n\n`));
      });

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

