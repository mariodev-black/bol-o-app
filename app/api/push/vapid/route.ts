import { NextResponse } from "next/server";
import { getVapidPublicKey, isWebPushConfigured } from "@/lib/push/config";

export const runtime = "nodejs";

export async function GET() {
  const publicKey = getVapidPublicKey();
  if (!isWebPushConfigured() || !publicKey) {
    return NextResponse.json(
      { configured: false, publicKey: null },
      { status: 503 },
    );
  }
  return NextResponse.json({ configured: true, publicKey });
}
