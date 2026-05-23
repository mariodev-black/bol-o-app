import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Skale foi descontinuado — use 3xPay.
 * Mantido para retornar 410 e evitar retries antigos no postback da Skale.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Gateway Skale descontinuado. Configure o webhook na 3xPay para /api/webhooks/threexpay",
    },
    { status: 410 },
  );
}
