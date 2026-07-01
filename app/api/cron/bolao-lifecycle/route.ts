import { NextResponse } from "next/server";
import { runBolaoLifecycleTick } from "@/lib/boloes/definitions/lifecycle-worker";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

/** Atualiza status automático e premiação dos bolões configuráveis. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runBolaoLifecycleTick();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/bolao-lifecycle]", error);
    return NextResponse.json({ error: "Falha no lifecycle tick" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
