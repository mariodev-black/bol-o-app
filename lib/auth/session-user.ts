import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";

export async function requireSessionUserId(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get("cookie") || "";
  const name = sessionCookieName();
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  const token = match?.[1] ? decodeURIComponent(match[1]) : null;
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}
