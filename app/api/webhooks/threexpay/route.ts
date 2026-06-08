import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * 3xPay descontinuado — use Skale Payments.
 * Mantido para retornar 410 e evitar retries antigos no callback da 3xPay.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Gateway 3xPay descontinuado. Configure o postback na Skale Payments para /api/webhooks/skale",
    },
    { status: 410 },
  );
}
