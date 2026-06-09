import { NextRequest, NextResponse } from "next/server";
import { bootstrapEmailOnStartup } from "@/lib/email/bootstrap";
import {
  dispatchCopaBolaoSlotToAllUsers,
  isCopaBolaoSlotId,
  runCopaBolaoSlot,
} from "@/lib/email/campaigns/copa-bolao-2026";

export const runtime = "nodejs";
/** Campanha em massa pode levar vários minutos. */
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  if (request.headers.get("x-vercel-cron") === "1") return true;
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  const bearer = request.headers.get("authorization") || "";
  if (bearer === `Bearer ${secret}`) return true;
  return (request.nextUrl.searchParams.get("secret") || "") === secret;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const slotRaw = request.nextUrl.searchParams.get("slot") ?? "";
  if (!isCopaBolaoSlotId(slotRaw)) {
    return NextResponse.json(
      { error: "Parametro slot invalido ou ausente", slotRaw },
      { status: 400 },
    );
  }

  const force = request.nextUrl.searchParams.get("force");
  const dryRun = request.nextUrl.searchParams.get("dryRun");
  const shouldForce = force === "1" || force === "true";
  const shouldDryRun = dryRun === "1" || dryRun === "true";

  try {
    await bootstrapEmailOnStartup();
    const result = shouldForce
      ? await dispatchCopaBolaoSlotToAllUsers(slotRaw, { dryRun: shouldDryRun })
      : await runCopaBolaoSlot(slotRaw, { dryRun: shouldDryRun });
    return NextResponse.json({ ok: true, slot: slotRaw, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha na campanha de e-mail";
    console.error("[cron] email-campaign-copa-bolao", { slot: slotRaw, error });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
