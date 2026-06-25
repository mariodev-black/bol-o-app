import {
  buildCartwaveFailureMessage,
  readCartwaveHttpFailure,
} from "@/lib/payments/cartwave/errors";
import {
  cartwaveApiBaseUrl,
  cartwaveClientId,
  cartwaveClientSecret,
} from "@/lib/payments/cartwave/config";
import { cartwaveFetch } from "@/lib/payments/cartwave/http";

type TokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

let tokenCache: TokenCache | null = null;

declare global {
  var __cartwaveTokenCache: TokenCache | undefined;
}

function readCache(): TokenCache | null {
  return globalThis.__cartwaveTokenCache ?? tokenCache;
}

function writeCache(entry: TokenCache): void {
  tokenCache = entry;
  globalThis.__cartwaveTokenCache = entry;
}

const CARTWAVE_DEBUG = (process.env.CARTWAVE_DEBUG ?? "").trim() === "1";

export async function getCartwaveAccessToken(): Promise<string> {
  const cached = readCache();
  if (cached && Date.now() < cached.expiresAtMs - 60_000) {
    return cached.accessToken;
  }

  const url = `${cartwaveApiBaseUrl().replace(/\/$/, "")}/v2/finance/auth-token/`;
  const res = await cartwaveFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "bol-o-app/cartwave-auth",
    },
    body: JSON.stringify({
      client_id: cartwaveClientId(),
      client_secret: cartwaveClientSecret(),
    }),
  });

  const failure = await readCartwaveHttpFailure(res);
  const data = failure.parsed ?? {};

  if (CARTWAVE_DEBUG || !res.ok) {
    console.error("[cartwave/auth]", {
      url,
      status: failure.status,
      cloudfrontBlocked: failure.cloudfrontBlocked,
      cloudFrontPop: failure.cloudFrontPop,
      headers: failure.headers,
      bodyPreview: failure.bodyPreview.slice(0, 300),
    });
  }

  const token = typeof data.access_token === "string" ? data.access_token : null;
  if (!res.ok || !token) {
    throw new Error(buildCartwaveFailureMessage(failure, "Auth Cartwave"));
  }

  writeCache({
    accessToken: token,
    expiresAtMs: Date.now() + 55 * 60_000,
  });
  return token;
}
