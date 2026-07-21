import {
  assertFyhubCashoutConfigured,
  fyhubClientId,
  fyhubClientSecret,
} from "@/lib/payments/fyhub/config";
import { fyhubAccountsFetch, fyhubAccountsUrl } from "@/lib/payments/fyhub/http";

type TokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

let tokenCache: TokenCache | null = null;

declare global {
  // eslint-disable-next-line no-var
  var __fyhubAccountsTokenCache: TokenCache | undefined;
}

function readCache(): TokenCache | null {
  return globalThis.__fyhubAccountsTokenCache ?? tokenCache;
}

function writeCache(entry: TokenCache): void {
  tokenCache = entry;
  globalThis.__fyhubAccountsTokenCache = entry;
}

export async function getFyhubAccountsAccessToken(): Promise<string> {
  assertFyhubCashoutConfigured();

  const cached = readCache();
  if (cached && Date.now() < cached.expiresAtMs - 30_000) {
    return cached.accessToken;
  }

  const res = await fyhubAccountsFetch(fyhubAccountsUrl("/oauth/token"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: fyhubClientId(),
      client_secret: fyhubClientSecret(),
      grant_type: "client_credentials",
    }),
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`Fyhub Contas OAuth retornou resposta invalida (${res.status})`);
  }

  const token = typeof json.access_token === "string" ? json.access_token : null;
  if (!res.ok || !token) {
    console.error("[fyhub/accounts/auth]", { status: res.status, body: text.slice(0, 400) });
    const msg =
      (typeof json.detail === "string" && json.detail) ||
      (typeof json.title === "string" && json.title) ||
      (typeof json.message === "string" && json.message) ||
      `Auth Fyhub Contas falhou (${res.status})`;
    throw new Error(msg);
  }

  const expiresIn =
    typeof json.expires_in === "number" && Number.isFinite(json.expires_in)
      ? Math.max(60, Math.trunc(json.expires_in))
      : 300;

  writeCache({ accessToken: token, expiresAtMs: Date.now() + expiresIn * 1000 });
  return token;
}
