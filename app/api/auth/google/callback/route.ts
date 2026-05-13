import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie } from "@/lib/auth/session";
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

function appBase(): string | null {
  const u = process.env.APP_URL?.replace(/\/$/, "");
  return u || null;
}

async function exchangeCode(code: string, redirectUri: string): Promise<{ access_token?: string } | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

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

  if (!res.ok) return null;
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
  if (!r.ok) return null;
  return r.json() as Promise<{
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  }>;
}

export async function GET(request: NextRequest) {
  const base = appBase();
  if (!base) {
    return NextResponse.json({ error: "APP_URL não configurada" }, { status: 500 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  const failRedirect = (reason: string) =>
    NextResponse.redirect(`${base}/login?error=${encodeURIComponent(reason)}`);

  if (err) {
    return failRedirect("google_denied");
  }

  if (!code || !state) {
    return failRedirect("google_invalid");
  }

  const cookieState = request.cookies.get(STATE_COOKIE)?.value;
  if (!cookieState || cookieState !== state) {
    return failRedirect("google_state");
  }

  const redirectUri = `${base}${GOOGLE_OAUTH_CALLBACK_PATH}`;
  const tokens = await exchangeCode(code, redirectUri);
  if (!tokens?.access_token) {
    return failRedirect("google_token");
  }

  const profile = await fetchGoogleProfile(tokens.access_token);
  if (!profile?.sub || !profile.email) {
    return failRedirect("google_profile");
  }

  const googleSub = profile.sub;
  const email = profile.email;
  const emailVerified = Boolean(profile.email_verified);
  const name = profile.name?.trim() || null;
  const picture = profile.picture?.trim() || null;

  const refCookie = request.cookies.get(REFERRAL_COOKIE)?.value;
  let referredByUserId: string | null = null;
  if (refCookie) {
    referredByUserId = await findUserIdByReferralCode(refCookie);
  }

  try {
    let userId: string;

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
      }
    }

    await tryPersistGooglePictureAsAvatarUpload(userId, picture).catch(() => {});

    const returnTo = safeReturnPath(request.cookies.get(RETURN_COOKIE)?.value);
    const res = NextResponse.redirect(`${base}${returnTo ?? "/boloes"}`);
    res.cookies.set(STATE_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    res.cookies.set(REFERRAL_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    res.cookies.set(RETURN_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    await attachSessionCookie(res, userId);
    return res;
  } catch (e: unknown) {
    const pg = e as { code?: string };
    if (pg.code === "23505") {
      return failRedirect("google_conflict");
    }
    console.error("[auth/google/callback]", e);
    return failRedirect("google_server");
  }
}
