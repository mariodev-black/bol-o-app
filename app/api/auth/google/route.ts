import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { normalizeReferralCodeInput } from "@/lib/auth/referral-code";
import { oauthStateCookieOptions } from "@/lib/auth/session";
import { oauthLog, oauthRequestSnapshot, oauthWarn } from "@/lib/auth/oauth-console";
import { getOAuthPublicOrigin } from "@/lib/auth/request-host";
import { GOOGLE_OAUTH_CALLBACK_PATH, GOOGLE_OAUTH_SCOPES } from "@/lib/google/oauth-config";

export const runtime = "nodejs";

const STATE_COOKIE = "bolao_oauth_state";
const REFERRAL_COOKIE = "bolao_oauth_referral";
const RETURN_COOKIE = "bolao_oauth_return";

function safeReturnPath(from: string | null): string | null {
  if (!from || !from.startsWith("/") || from.startsWith("//")) return null;
  if (from.startsWith("/login") || from.startsWith("/cadastrar")) return null;
  return from;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    oauthWarn("google_start_missing_client_id", {});
    return NextResponse.json(
      { error: "Login com Google não configurado (GOOGLE_CLIENT_ID)" },
      { status: 503 }
    );
  }

  const publicOrigin = getOAuthPublicOrigin(request);
  const state = randomBytes(24).toString("hex");
  const redirectUri = `${publicOrigin}${GOOGLE_OAUTH_CALLBACK_PATH}`;

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_OAUTH_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");

  const res = NextResponse.redirect(url.toString());
  const oc = oauthStateCookieOptions(request);
  res.cookies.set(STATE_COOKIE, state, oc);

  const refRaw = request.nextUrl.searchParams.get("ref");
  const refNorm = normalizeReferralCodeInput(refRaw ?? undefined);
  if (refNorm) {
    res.cookies.set(REFERRAL_COOKIE, refNorm, oc);
  }
  const returnTo = safeReturnPath(request.nextUrl.searchParams.get("from"));
  if (returnTo) {
    res.cookies.set(RETURN_COOKIE, returnTo, oc);
  }

  oauthLog("google_start", {
    ...oauthRequestSnapshot(request),
    redirectUri,
    stateLen: state.length,
    stateSuffix: state.slice(-6),
    hasReferralCookie: Boolean(refNorm),
    returnTo: returnTo ?? null,
    clientIdSuffix: clientId.slice(-8),
  });

  return res;
}
