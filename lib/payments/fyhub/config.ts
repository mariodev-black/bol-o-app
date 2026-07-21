import fs from "node:fs";
import path from "node:path";

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

/** API Contas (Pix Out / saques) — distinta da API QRCode. */
export function fyhubAccountsApiBaseUrl(): string {
  return env("FYHUB_ACCOUNTS_API_BASE_URL") || "https://pagamentos.fyhub.com.br/api/v2";
}

export function fyhubClientId(): string {
  return env("FYHUB_CLIENT_ID");
}

export function fyhubClientSecret(): string {
  return env("FYHUB_CLIENT_SECRET");
}

export function fyhubRejectUnauthorized(): boolean {
  const raw = env("FYHUB_REJECT_UNAUTHORIZED").toLowerCase();
  if (!raw) return true;
  return raw !== "0" && raw !== "false" && raw !== "no" && raw !== "off";
}

export function isFyhubCashoutConfigured(): boolean {
  return Boolean(fyhubClientId() && fyhubClientSecret());
}

function resolvePath(envName: string, fallbackRelative: string): string {
  const fromEnv = env(envName);
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.join(process.cwd(), fromEnv);
  }
  return path.join(process.cwd(), fallbackRelative);
}

/**
 * Certificado da API Contas (Pix Out).
 * A Fyhub exige certificado diferente do da API QRCode.
 * Default: mesmo par em app/api/certificates (configure FYHUB_ACCOUNTS_* se for outro).
 */
export function fyhubAccountsCertPath(): string {
  return resolvePath(
    "FYHUB_ACCOUNTS_CERT_PATH",
    env("FYHUB_CERT_PATH") || "app/api/certificates/FYHUB_62.crt",
  );
}

export function fyhubAccountsKeyPath(): string {
  return resolvePath(
    "FYHUB_ACCOUNTS_KEY_PATH",
    env("FYHUB_KEY_PATH") || "app/api/certificates/FYHUB_62.key",
  );
}

export function fyhubAccountsPfxPassword(): string {
  return env("FYHUB_ACCOUNTS_PFX_PASSWORD");
}

export function loadFyhubAccountsMtlsMaterials(): { cert: Buffer; key: Buffer } {
  const certPath = fyhubAccountsCertPath();
  const keyPath = fyhubAccountsKeyPath();
  if (!fs.existsSync(certPath)) {
    throw new Error(`Certificado Fyhub Contas nao encontrado: ${certPath}`);
  }
  if (!fs.existsSync(keyPath)) {
    throw new Error(`Chave privada Fyhub Contas nao encontrada: ${keyPath}`);
  }
  return {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  };
}

export function assertFyhubCashoutConfigured(): void {
  if (!isFyhubCashoutConfigured()) {
    throw new Error(
      "Fyhub cashout nao configurado — preencha FYHUB_CLIENT_ID e FYHUB_CLIENT_SECRET (API Contas)",
    );
  }
}

export function fyhubWebhookUrl(): string {
  const app =
    (process.env.APP_URL || "https://app.bolaodomilhao.com.br").trim().replace(/\/+$/, "");
  return `${app}/api/webhooks/fyhub`;
}

/** Idempotency Fyhub: `[a-zA-Z0-9]{1,50}` — UUID sem hífens. */
export function fyhubIdempotencyKeyFromUuid(uuid: string): string {
  const compact = uuid.replace(/-/g, "").trim();
  if (!/^[a-zA-Z0-9]{1,50}$/.test(compact)) {
    throw new Error("Idempotency key Fyhub invalida (use UUID)");
  }
  return compact.slice(0, 50);
}
