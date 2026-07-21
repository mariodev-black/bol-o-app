/**
 * Teste OAuth + (opcional) cashout dry-run Fyhub Contas.
 *
 *   npm run debug:fyhub-cashout
 *   npm run debug:fyhub-cashout -- --cashout
 *
 * Env opcional para cashout de teste:
 *   FYHUB_DEBUG_PIX_KEY=cpf-ou-email-ou-telefone
 *   FYHUB_DEBUG_AMOUNT_CENTS=100
 */
import { config } from "dotenv";
config({ path: ".env" });

import fs from "node:fs";
import https from "node:https";
import { URL } from "node:url";
import { getFyhubAccountsAccessToken } from "@/lib/payments/fyhub/auth";
import {
  fyhubAccountsApiBaseUrl,
  fyhubAccountsCertPath,
  fyhubAccountsKeyPath,
  fyhubClientId,
  fyhubRejectUnauthorized,
  isFyhubCashoutConfigured,
  loadFyhubAccountsMtlsMaterials,
} from "@/lib/payments/fyhub/config";
import { createFyhubPixCashout } from "@/lib/payments/fyhub/cashout";
import { fyhubAccountsFetch, fyhubAccountsUrl } from "@/lib/payments/fyhub/http";

function mask(value: string, keep = 4): string {
  if (!value) return "(vazio)";
  if (value.length <= keep * 2) return "***";
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}

function explainTlsError(err: unknown): void {
  const e = err as NodeJS.ErrnoException & { reason?: string; library?: string };
  console.error("\n── Diagnóstico TLS/mTLS ──");
  console.error("code:", e.code ?? "(sem code)");
  console.error("reason:", e.reason ?? e.message);
  if (e.code === "ERR_SSL_TLSV1_ALERT_UNKNOWN_CA" || String(e.message).includes("unknown ca")) {
    console.error(
      [
        "",
        "Causa provável: o certificado cliente NÃO é aceito pela API Contas.",
        "FYHUB_36 costuma ser da API QRCode (cobrança). Cash-out exige o par mTLS da API Contas.",
        "Peça à Fyhub o certificado/chave (ou .pfx) da API Contas e aponte:",
        "  FYHUB_ACCOUNTS_CERT_PATH=...",
        "  FYHUB_ACCOUNTS_KEY_PATH=...",
      ].join("\n"),
    );
  }
  if (e.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
    console.error(
      "\nCausa: Node não confia no certificado do servidor. Com FYHUB_REJECT_UNAUTHORIZED=false o client ainda envia mTLS.",
    );
  }
}

async function probeTlsHandshake(): Promise<void> {
  const { cert, key } = loadFyhubAccountsMtlsMaterials();
  const target = new URL(fyhubAccountsUrl("/oauth/token"));
  console.log("\n── Probe TLS (CONNECT) ──");
  console.log("URL:", target.href);

  await new Promise<void>((resolve) => {
    const req = https.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 443,
        path: target.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": "2",
        },
        agent: new https.Agent({
          cert,
          key,
          rejectUnauthorized: fyhubRejectUnauthorized(),
        }),
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          console.log("HTTP status:", res.statusCode);
          console.log("Body (até 500 chars):", body.slice(0, 500) || "(vazio)");
          resolve();
        });
      },
    );
    req.on("error", (err) => {
      console.error("Handshake/request falhou:");
      console.error(err);
      explainTlsError(err);
      resolve();
    });
    req.write("{}");
    req.end();
  });
}

async function tryOauthRaw(): Promise<void> {
  console.log("\n── OAuth /oauth/token ──");
  const body = JSON.stringify({
    client_id: fyhubClientId(),
    client_secret: process.env.FYHUB_CLIENT_SECRET?.trim(),
    grant_type: "client_credentials",
  });
  try {
    const res = await fyhubAccountsFetch(fyhubAccountsUrl("/oauth/token"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body,
    });
    const text = await res.text();
    console.log("HTTP status:", res.status);
    console.log("Body:", text.slice(0, 800) || "(vazio)");
    if (res.ok) {
      const json = JSON.parse(text) as { access_token?: string; expires_in?: number; scope?: string };
      console.log("access_token length:", json.access_token?.length ?? 0);
      console.log("expires_in:", json.expires_in);
      console.log("scope:", json.scope ?? "(nao informado)");
    }
  } catch (err) {
    console.error("OAuth request erro:");
    console.error(err);
    explainTlsError(err);
  }
}

async function tryTokenViaHelper(): Promise<string | null> {
  console.log("\n── getFyhubAccountsAccessToken() ──");
  try {
    const token = await getFyhubAccountsAccessToken();
    console.log("OK — token length:", token.length);
    return token;
  } catch (err) {
    console.error("Falha:");
    console.error(err);
    explainTlsError(err);
    return null;
  }
}

async function tryCashoutDryRun(): Promise<void> {
  const pixKey = (process.env.FYHUB_DEBUG_PIX_KEY ?? "").trim();
  const amountCents = Number(process.env.FYHUB_DEBUG_AMOUNT_CENTS ?? "100");
  if (!pixKey) {
    console.log(
      "\n── Cashout dry-run pulado ──\nDefina FYHUB_DEBUG_PIX_KEY (e opcional FYHUB_DEBUG_AMOUNT_CENTS) para testar POST /pix/payments/dict",
    );
    return;
  }
  console.log("\n── Cashout POST /pix/payments/dict ──");
  console.log("pixKey:", mask(pixKey, 3));
  console.log("amountCents:", amountCents);
  const withdrawalId = "00000000-0000-4000-8000-000000000001";
  try {
    const result = await createFyhubPixCashout({
      amountCents,
      pixKeyType: pixKey.includes("@") ? "email" : /^\d{11}$/.test(pixKey.replace(/\D/g, "")) ? "cpf" : "random",
      pixKey,
      withdrawalId,
      description: "debug-fyhub-cashout",
    });
    console.log("OK:", {
      transactionId: result.transactionId,
      status: result.status,
      endToEndId: result.endToEndId,
      idempotencyKey: result.idempotencyKey,
    });
    console.log("raw keys:", Object.keys(result.raw));
  } catch (err) {
    console.error("Cashout falhou:");
    console.error(err);
  }
}

async function main() {
  const wantCashout = process.argv.includes("--cashout");
  const certPath = fyhubAccountsCertPath();
  const keyPath = fyhubAccountsKeyPath();

  console.log("=== Debug Fyhub Contas (cashout) ===");
  console.log("Base URL:", fyhubAccountsApiBaseUrl());
  console.log("Client ID:", mask(fyhubClientId(), 6));
  console.log("Configured:", isFyhubCashoutConfigured());
  console.log("rejectUnauthorized:", fyhubRejectUnauthorized());
  console.log("Cert path:", certPath, fs.existsSync(certPath) ? "OK" : "MISSING");
  console.log("Key path:", keyPath, fs.existsSync(keyPath) ? "OK" : "MISSING");
  if (fs.existsSync(certPath)) {
    const pem = fs.readFileSync(certPath, "utf8");
    console.log("Cert PEM starts:", pem.slice(0, 40).replace(/\n/g, "\\n"));
  }

  if (!isFyhubCashoutConfigured()) {
    throw new Error("Preencha FYHUB_CLIENT_ID e FYHUB_CLIENT_SECRET (API Contas)");
  }

  await probeTlsHandshake();
  await tryOauthRaw();
  const token = await tryTokenViaHelper();

  if (token && wantCashout) {
    await tryCashoutDryRun();
  } else if (wantCashout && !token) {
    console.log("\nCashout não executado — OAuth falhou antes.");
  } else {
    console.log("\nDica: rode com --cashout e FYHUB_DEBUG_PIX_KEY=... para testar o Pix Out.");
  }

  console.log("\n=== Fim ===");
  if (!token) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  explainTlsError(e);
  process.exit(1);
});
