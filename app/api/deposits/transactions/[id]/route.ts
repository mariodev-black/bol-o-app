import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { getDepositTransactionById, updateTransactionStatusByProviderId } from "@/lib/payments/transactions";

export const runtime = "nodejs";

const patchSchema = z
  .object({
    providerTransactionId: z.string().min(1).optional(),
    status: z.string().min(1),
    pix: z
      .object({
        qrcode: z.string().optional().nullable(),
        end2EndId: z.string().optional().nullable(),
      })
      .optional(),
  })
  .strict();

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
  if (!userId) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const { id } = await context.params;
  const transaction = await getDepositTransactionById(userId, id);
  if (!transaction) return NextResponse.json({ error: "Transacao nao encontrada" }, { status: 404 });
  return NextResponse.json({ transaction });
}

/**
 * Atualizacao manual só em desenvolvimento local.
 * Em producao o status vem exclusivamente do webhook Skale (`/api/webhooks/skale`).
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Atualizacao manual de transacao desabilitada em producao" },
      { status: 403 },
    );
  }

  const userId = await authUserId(request);
  if (!userId) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const { id } = await context.params;
  const existing = await getDepositTransactionById(userId, id);
  if (!existing) return NextResponse.json({ error: "Transacao nao encontrada" }, { status: 404 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados invalidos" }, { status: 400 });
  }

  const providerTransactionId = parsed.data.providerTransactionId ?? existing.providerTransactionId;
  if (!providerTransactionId) {
    return NextResponse.json(
      { error: "Transacao sem providerTransactionId para atualizacao" },
      { status: 400 }
    );
  }

  await updateTransactionStatusByProviderId({
    providerTransactionId,
    status: parsed.data.status,
    pixQrcode: parsed.data.pix?.qrcode,
    pixEnd2EndId: parsed.data.pix?.end2EndId,
    rawWebhook: { source: "manual_patch", payload: parsed.data },
  });

  const fresh = await getDepositTransactionById(userId, id);
  return NextResponse.json({ transaction: fresh });
}
