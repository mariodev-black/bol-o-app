import { NextResponse } from "next/server";
import { getAppServerConfig } from "@/lib/app-server-config";

export const runtime = "nodejs";

/** Config pública da promo Copa → extra grátis (modal + checkout). */
export async function GET() {
  return NextResponse.json(getAppServerConfig().copaBonusPromo);
}
