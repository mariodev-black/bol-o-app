import { NextRequest, NextResponse } from "next/server";
import { oauthErr, oauthLog, oauthRequestSnapshot, oauthWarn } from "@/lib/auth/oauth-console";
import { getOAuthPublicOrigin } from "@/lib/auth/request-host";
import { attachSessionCookie, oauthStateCookieOptions, sessionCookieDomain } from "@/lib/auth/session";
import { findUserIdByReferralCode } from "@/lib/auth/referral-code";
import {
  createUserFromGoogle,
  findUserByEmail,
  findUserByGoogleSub,
  linkGoogleToExistingUser,
  syncGoogleProfileFields,
  tryPersistGooglePictureAsAvatarUpload,
} from "@/lib/auth/users";
import { GOOGLE_OAUTH_CALLBACK_PATH } from "@/lib/google/oauth-config";

export const runtime = "nodejs";

const STATE_COOKIE = "bolao_oauth_state";
const REFERRAL_COOKIE = "bolao_oauth_referral";
const RETURN_COOKIE = "bolao_oauth_return";

function safeReturnPath(from: string | undefined): string | null {
  if (!from || !from.startsWith("/") || from.startsWith("//")) return null;
  if (from.startsWith("/login") || from.startsWith("/cadastrar")) return null;
  return from;
}

async function exchangeCode(code: string, redirectUri: string): Promise<{ access_token?: string } | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    oauthErr("google_token_exchange_skip_missing_env", {
      hasClientId: Boolean(clientId),
      hasClientSecret: Boolean(clientSecret),
    });
    return null;
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    oauthErr("google_token_exchange_http_error", {
      status: res.status,
      bodyPreview: text.slice(0, 800),
      redirectUriUsed: redirectUri,
    });
    return null;
  }
  oauthLog("google_token_exchange_ok", { redirectUriUsed: redirectUri });
  return res.json() as Promise<{ access_token?: string }>;
}

async function fetchGoogleProfile(accessToken: string): Promise<{
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
} | null> {
  const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    oauthWarn("google_userinfo_http_error", { status: r.status });
    return null;
  }
  return r.json() as Promise<{
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  }>;
}

export async function GET(request: NextRequest) {
  const publicOrigin = getOAuthPublicOrigin(request);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  oauthLog("google_callback_hit", {
    ...oauthRequestSnapshot(request),
    hasCode: Boolean(code),
    codeLen: code?.length ?? 0,
    hasStateParam: Boolean(state),
    stateParamLen: state?.length ?? 0,
    googleErrorParam: err,
    hasStateCookie: Boolean(request.cookies.get(STATE_COOKIE)?.value),
    stateCookieLen: request.cookies.get(STATE_COOKIE)?.value?.length ?? 0,
  });

  const failRedirect = (reason: string) => {
    oauthWarn("google_callback_fail_redirect", { reason, publicOrigin, ...oauthRequestSnapshot(request) });
    return NextResponse.redirect(`${publicOrigin}/login?error=${encodeURIComponent(reason)}`);
  };

  if (err) {
    return failRedirect("google_denied");
  }

  if (!code || !state) {
    return failRedirect("google_invalid");
  }

  const cookieState = request.cookies.get(STATE_COOKIE)?.value;
  if (!cookieState || cookieState !== state) {
    oauthWarn("google_callback_state_mismatch", {
      cookieStateLen: cookieState?.length ?? 0,
      paramStateLen: state.length,
      stateSuffixMatch:
        Boolean(cookieState && state.length >= 6 && cookieState.slice(-6) === state.slice(-6)),
    });
    return failRedirect("google_state");
  }

  const redirectUri = `${publicOrigin}${GOOGLE_OAUTH_CALLBACK_PATH}`;
  const tokens = await exchangeCode(code, redirectUri);
  if (!tokens?.access_token) {
    oauthWarn("google_callback_no_access_token", {
      tokenKeys: tokens ? Object.keys(tokens) : [],
      ...oauthRequestSnapshot(request),
    });
    return failRedirect("google_token");
  }

  const profile = await fetchGoogleProfile(tokens.access_token);
  if (!profile?.sub || !profile.email) {
    oauthWarn("google_callback_profile_incomplete", {
      hasSub: Boolean(profile?.sub),
      hasEmail: Boolean(profile?.email),
    });
    return failRedirect("google_profile");
  }

  const googleSub = profile.sub;
  const email = profile.email;
  const emailVerified = Boolean(profile.email_verified);
  const name = profile.name?.trim() || null;
  const picture = profile.picture?.trim() || null;

  oauthLog("google_callback_profile_ok", {
    emailDomain: email.includes("@") ? email.split("@")[1] : "(no-at)",
    emailVerified,
    subLen: googleSub.length,
    hasName: Boolean(name),
    hasPicture: Boolean(picture),
  });

  const refCookie = request.cookies.get(REFERRAL_COOKIE)?.value;
  let referredByUserId: string | null = null;
  if (refCookie) {
    referredByUserId = await findUserIdByReferralCode(refCookie);
  }

  try {
    let userId: string;
    let authMode: "existing_google_sub" | "linked_email" | "created_google" = "existing_google_sub";

    const bySub = await findUserByGoogleSub(googleSub);
    if (bySub) {
      userId = bySub.id;
      await syncGoogleProfileFields(userId, name, picture, emailVerified).catch(() => {});
    } else {
      const byEmail = await findUserByEmail(email);
      if (byEmail) {
        if (byEmail.google_sub && byEmail.google_sub !== googleSub) {
          return failRedirect("google_email_linked");
        }
        const linked = await linkGoogleToExistingUser(
          byEmail.id,
          googleSub,
          name,
          picture,
          emailVerified
        );
        userId = linked.id;
        authMode = "linked_email";
      } else {
        const created = await createUserFromGoogle({
          email,
          googleSub,
          name,
          avatarUrl: picture,
          emailVerified,
          referredByUserId,
        });
        userId = created.id;
        authMode = "created_google";
      }
    }

    await tryPersistGooglePictureAsAvatarUpload(userId, picture).catch(() => {});

    const returnTo = safeReturnPath(request.cookies.get(RETURN_COOKIE)?.value);
    const targetPath = returnTo ?? "/boloes";
    const res = NextResponse.redirect(`${publicOrigin}${targetPath}`);
    const oc = { ...oauthStateCookieOptions(request), maxAge: 0 };
    res.cookies.set(STATE_COOKIE, "", oc);
    res.cookies.set(REFERRAL_COOKIE, "", oc);
    res.cookies.set(RETURN_COOKIE, "", oc);
    await attachSessionCookie(res, userId, request);

    oauthLog("google_callback_success", {
      authMode,
      userIdPrefix: `${userId.slice(0, 8)}…`,
      emailDomain: email.includes("@") ? email.split("@")[1] : "(no-at)",
      returnTo: targetPath,
      sessionCookieDomain: sessionCookieDomain(request) ?? "(host-only)",
      referredBySet: Boolean(referredByUserId),
    });

    return res;
  } catch (e: unknown) {
    const pg = e as { code?: string };
    if (pg.code === "23505") {
      return failRedirect("google_conflict");
    }
    oauthErr("google_callback_exception", { message: e instanceof Error ? e.message : String(e) });
    return failRedirect("google_server");
  }
}
