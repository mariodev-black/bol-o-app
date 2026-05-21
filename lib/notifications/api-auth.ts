import type { NextRequest } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";

export async function notificationsAuthUserId(
  request: NextRequest,
): Promise<string | null> {
  const token = request.cookies.get(sessionCookieName())?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}
