function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function isCartwaveConfigured(): boolean {
  return Boolean(
    env("CARTWAVE_CLIENT_ID") &&
      env("CARTWAVE_CLIENT_SECRET") &&
      env("CARTWAVE_HMAC_KEY") &&
      env("CARTWAVE_SOURCE_ACCOUNT_BRANCH") &&
      env("CARTWAVE_SOURCE_ACCOUNT_NUMBER"),
  );
}

export function cartwaveApiBaseUrl(): string {
  return env("CARTWAVE_API_BASE_URL") || "https://api.cartwavehub.com.br";
}

export function cartwaveClientId(): string {
  const v = env("CARTWAVE_CLIENT_ID");
  if (!v) throw new Error("CARTWAVE_CLIENT_ID nao configurado");
  return v;
}

export function cartwaveClientSecret(): string {
  const v = env("CARTWAVE_CLIENT_SECRET");
  if (!v) throw new Error("CARTWAVE_CLIENT_SECRET nao configurado");
  return v;
}

export function cartwaveHmacKey(): string {
  const v = env("CARTWAVE_HMAC_KEY");
  if (!v) throw new Error("CARTWAVE_HMAC_KEY nao configurado");
  return v;
}

export function cartwaveSourceAccountBranch(): string {
  const v = env("CARTWAVE_SOURCE_ACCOUNT_BRANCH");
  if (!v) throw new Error("CARTWAVE_SOURCE_ACCOUNT_BRANCH nao configurado");
  return v;
}

export function cartwaveSourceAccountNumber(): string {
  const v = env("CARTWAVE_SOURCE_ACCOUNT_NUMBER");
  if (!v) throw new Error("CARTWAVE_SOURCE_ACCOUNT_NUMBER nao configurado");
  return v;
}

/** Endpoint PIX por chave (compatível com chaves CPF/e-mail/telefone/EVP do app). */
export function cartwaveCashoutPixSelfApprovePath(): string {
  return (
    env("CARTWAVE_CASHOUT_PIX_SELF_APPROVE_PATH") ||
    "/v2/finance/create-cashout-self-approve"
  );
}

export function cartwaveWebhookUrl(): string {
  const app = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  const base = app || "https://app.bolaodomilhao.com.br";
  return `${base}/api/webhooks/cartwave`;
}

/** IP local IPv4 para bind nas requisições de saída (o mesmo cadastrado na whitelist Cartwave). */
export function cartwaveOutboundIpv4(): string | null {
  const v = env("CARTWAVE_OUTBOUND_IPV4");
  return v || null;
}
