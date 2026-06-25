/**
 * Testa cashout Cartwave (saque PIX) para um CPF — exibe credenciais, rotas, body e erro completo.
 *
 * Uso:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/test-cartwave-cashout-cpf.ts
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/test-cartwave-cashout-cpf.ts 14700168420
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/test-cartwave-cashout-cpf.ts 14700168420 --amount-cents=2000
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/test-cartwave-cashout-cpf.ts --auth-only
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/test-cartwave-cashout-cpf.ts --withdrawal-id=<uuid>
 */

import "dotenv/config";
import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db";
import {
  cartwaveApiBaseUrl,
  cartwaveCashoutPixSelfApprovePath,
  cartwaveClientId,
  cartwaveClientSecret,
  cartwaveHmacKey,
  cartwaveSourceAccountBranch,
  cartwaveSourceAccountNumber,
  isCartwaveConfigured,
} from "@/lib/payments/cartwave/config";
import { pixKeyForCartwave } from "@/lib/payments/cartwave/cashout";
import { buildCartwaveFailureMessage, readCartwaveHttpFailure } from "@/lib/payments/cartwave/errors";
import { cartwaveNormalizeJsonBody, cartwaveSignBody } from "@/lib/payments/cartwave/hmac";
import { cartwaveFetch } from "@/lib/payments/cartwave/http";
import { runCartwaveNetworkDiagnostics } from "@/lib/payments/cartwave/network-diagnostics";
import { minAffiliateWithdrawalCents } from "@/lib/referrals/withdraw";

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function parseArgs(argv: string[]) {
  const flags = new Set<string>();
  let cpf = "14700168420";
  let amountCents: number | null = null;
  let withdrawalId: string | null = null;

  for (const arg of argv) {
    if (arg === "--auth-only") {
      flags.add("auth-only");
      continue;
    }
    if (arg.startsWith("--amount-cents=")) {
      amountCents = Number.parseInt(arg.slice("--amount-cents=".length), 10);
      continue;
    }
    if (arg.startsWith("--withdrawal-id=")) {
      withdrawalId = arg.slice("--withdrawal-id=".length).trim();
      continue;
    }
    if (arg.startsWith("--")) continue;
    if (/^\d{11}$/.test(onlyDigits(arg))) {
      cpf = onlyDigits(arg);
    }
  }

  return {
    authOnly: flags.has("auth-only"),
    cpf,
    amountCents,
    withdrawalId,
  };
}

function section(title: string) {
  console.log(`\n${"=".repeat(72)}\n${title}\n${"=".repeat(72)}`);
}

function printJson(label: string, value: unknown) {
  console.log(`\n--- ${label} ---`);
  console.log(JSON.stringify(value, null, 2));
}

async function testAuth() {
  const baseUrl = cartwaveApiBaseUrl().replace(/\/$/, "");
  const url = `${baseUrl}/v2/finance/auth-token/`;
  const body = {
    client_id: cartwaveClientId(),
    client_secret: cartwaveClientSecret(),
  };

  section("0) REDE / IPv4 (diagnostico Cartwave)");
  const network = await runCartwaveNetworkDiagnostics();
  printJson("NETWORK", network);
  for (const hint of network.hints) {
    console.log(`  • ${hint}`);
  }

  section("1) AUTH CARTWAVE (via cartwaveFetch — IPv4 fixo)");
  printJson("REQUEST URL", { method: "POST", url });
  printJson("REQUEST BODY", body);

  const res = await cartwaveFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "bol-o-app/cartwave-test-script",
    },
    body: JSON.stringify(body),
  });

  const failure = await readCartwaveHttpFailure(res);
  const token =
    failure.parsed && typeof failure.parsed.access_token === "string"
      ? failure.parsed.access_token
      : null;

  printJson("RESPONSE STATUS", {
    status: failure.status,
    statusText: failure.statusText,
    cloudfrontBlocked: failure.cloudfrontBlocked,
    cloudFrontPop: failure.cloudFrontPop,
  });
  printJson("RESPONSE HEADERS", failure.headers);
  printJson("RESPONSE BODY (parsed)", failure.parsed);
  if (!failure.isJson) {
    console.log("\n--- RESPONSE BODY (raw preview) ---");
    console.log(failure.bodyPreview);
  }

  if (!res.ok || !token) {
    throw new Error(buildCartwaveFailureMessage(failure, "Auth Cartwave"));
  }

  console.log("\nAuth OK — access_token obtido (", token.length, "chars)");
  return token;
}

async function loadUserByCpf(cpf: string) {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    email: string;
    name: string | null;
    cpf: string | null;
    balance_cents: number;
    affiliate_balance_cents: number;
  }>(
    `SELECT id::text, email, name, cpf, balance_cents, affiliate_balance_cents
     FROM users
     WHERE regexp_replace(COALESCE(cpf, ''), '\\D', '', 'g') = $1
     LIMIT 1`,
    [cpf],
  );
  return rows[0] ?? null;
}

async function loadWithdrawal(withdrawalId: string) {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    user_id: string;
    amount_cents: number;
    pix_key_type: string;
    pix_key: string;
    status: string;
    cartwave_transaction_id: number | null;
    cartwave_status: string | null;
    admin_note: string | null;
    created_at: Date;
  }>(
    `SELECT id::text, user_id::text, amount_cents, pix_key_type, pix_key, status,
            cartwave_transaction_id, cartwave_status, admin_note, created_at
     FROM affiliate_withdrawal_requests
     WHERE id = $1::uuid
     LIMIT 1`,
    [withdrawalId],
  );
  return rows[0] ?? null;
}

async function loadLatestPendingWithdrawalForUser(userId: string) {
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    amount_cents: number;
    pix_key_type: string;
    pix_key: string;
    status: string;
    created_at: Date;
  }>(
    `SELECT id::text, amount_cents, pix_key_type, pix_key, status, created_at
     FROM affiliate_withdrawal_requests
     WHERE user_id = $1::uuid AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

async function testCashout(input: {
  amountCents: number;
  pixKeyType: string;
  pixKey: string;
  idempotencyKey: string;
  tag: string;
  token: string;
}) {
  const amount = Math.round(input.amountCents) / 100;
  const body: Record<string, unknown> = {
    source_account_branch_identifier: cartwaveSourceAccountBranch(),
    source_account_number: cartwaveSourceAccountNumber(),
    amount,
    key: pixKeyForCartwave(input.pixKeyType, input.pixKey),
    tag: input.tag,
  };

  const normalizedBody = cartwaveNormalizeJsonBody(body);
  const hmac = cartwaveSignBody(body, cartwaveHmacKey());
  const baseUrl = cartwaveApiBaseUrl().replace(/\/$/, "");
  const path = cartwaveCashoutPixSelfApprovePath();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  section("2) CASHOUT CARTWAVE (PIX)");
  printJson("REQUEST URL", { method: "POST", url });
  printJson("REQUEST BODY (object)", body);
  console.log("\n--- REQUEST BODY (normalized string enviado) ---");
  console.log(normalizedBody);
  printJson("REQUEST HEADERS", {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${input.token.slice(0, 12)}…${input.token.slice(-8)} (${input.token.length} chars)`,
    hmac,
    "idempotency-key": input.idempotencyKey,
    "User-Agent": "bol-o-app/cartwave-test-script",
  });

  const res = await cartwaveFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${input.token}`,
      hmac,
      "idempotency-key": input.idempotencyKey,
      "User-Agent": "bol-o-app/cartwave-test-script",
    },
    body: normalizedBody,
  });

  const failure = await readCartwaveHttpFailure(res);
  printJson("RESPONSE STATUS", {
    status: failure.status,
    statusText: failure.statusText,
    cloudfrontBlocked: failure.cloudfrontBlocked,
    cloudFrontPop: failure.cloudFrontPop,
  });
  printJson("RESPONSE HEADERS", failure.headers);
  printJson("RESPONSE BODY (parsed)", failure.parsed);
  if (!failure.isJson) {
    console.log("\n--- RESPONSE BODY (raw preview) ---");
    console.log(failure.bodyPreview);
  }

  if (!res.ok) {
    throw new Error(buildCartwaveFailureMessage(failure, "Cartwave cashout"));
  }

  const raw = failure.parsed ?? {};
  if (raw.worked !== true) {
    const err =
      (typeof raw.erro_descriptor === "string" && raw.erro_descriptor) ||
      (typeof raw.new_erro_descriptor === "string" && raw.new_erro_descriptor) ||
      "Cartwave recusou o cashout (worked=false)";
    throw new Error(err);
  }

  console.log("\nCashout OK — transaction_id:", raw.transaction_id ?? raw.id ?? "(sem id)");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  section("CARTWAVE — CREDENCIAIS (.env)");
  printJson("ENV", {
    CARTWAVE_API_BASE_URL: process.env.CARTWAVE_API_BASE_URL ?? "(default https://api.cartwavehub.com.br)",
    CARTWAVE_CLIENT_ID: process.env.CARTWAVE_CLIENT_ID ?? "(vazio)",
    CARTWAVE_CLIENT_SECRET: process.env.CARTWAVE_CLIENT_SECRET ?? "(vazio)",
    CARTWAVE_HMAC_KEY: process.env.CARTWAVE_HMAC_KEY ?? "(vazio)",
    CARTWAVE_SOURCE_ACCOUNT_BRANCH: process.env.CARTWAVE_SOURCE_ACCOUNT_BRANCH ?? "(vazio)",
    CARTWAVE_SOURCE_ACCOUNT_NUMBER: process.env.CARTWAVE_SOURCE_ACCOUNT_NUMBER ?? "(vazio)",
    CARTWAVE_CASHOUT_PIX_SELF_APPROVE_PATH:
      process.env.CARTWAVE_CASHOUT_PIX_SELF_APPROVE_PATH ??
      "/v2/finance/create-cashout-self-approve",
    CARTWAVE_WEBHOOK_SECRET: process.env.CARTWAVE_WEBHOOK_SECRET ?? "(vazio)",
    CARTWAVE_OUTBOUND_IPV4: process.env.CARTWAVE_OUTBOUND_IPV4 ?? "(vazio — risco IPv6)",
  });

  if (!isCartwaveConfigured()) {
    throw new Error("Cartwave nao configurado — preencha CARTWAVE_* no .env");
  }

  console.log("\n(isCartwaveConfigured = true)");

  const token = await testAuth();
  if (args.authOnly) {
    console.log("\n--auth-only: parando apos auth.");
    return;
  }

  section("USUARIO / SAQUE NO BANCO");
  let amountCents = args.amountCents ?? minAffiliateWithdrawalCents();
  let pixKeyType = "cpf";
  let pixKey = args.cpf;
  let idempotencyKey = randomUUID();
  let tag = `bolao-test:${args.cpf}`;

  if (args.withdrawalId) {
    const w = await loadWithdrawal(args.withdrawalId);
    if (!w) throw new Error(`Solicitacao ${args.withdrawalId} nao encontrada`);
    printJson("WITHDRAWAL", w);
    amountCents = w.amount_cents;
    pixKeyType = w.pix_key_type;
    pixKey = w.pix_key;
    idempotencyKey = w.id;
    tag = `bolao-withdraw:${w.id}`;
  } else {
    const user = await loadUserByCpf(args.cpf);
    if (!user) {
      console.warn(`Usuario com CPF ${args.cpf} nao encontrado — usando CPF direto no PIX.`);
    } else {
      printJson("USER", user);
      const pending = await loadLatestPendingWithdrawalForUser(user.id);
      if (pending) {
        printJson("PENDING WITHDRAWAL (sera usada)", pending);
        amountCents = pending.amount_cents;
        pixKeyType = pending.pix_key_type;
        pixKey = pending.pix_key;
        idempotencyKey = pending.id;
        tag = `bolao-withdraw:${pending.id}`;
      } else {
        console.log("Nenhum saque pending — teste direto na Cartwave (nao altera banco).");
        pixKey = onlyDigits(user.cpf ?? args.cpf);
      }
    }
  }

  printJson("CASHOUT INPUT", {
    amountCents,
    amountBRL: (amountCents / 100).toFixed(2),
    pixKeyType,
    pixKey,
    pixKeyNormalized: pixKeyForCartwave(pixKeyType, pixKey),
    idempotencyKey,
    tag,
  });

  await testCashout({
    amountCents,
    pixKeyType,
    pixKey,
    idempotencyKey,
    tag,
    token,
  });
}

main()
  .catch((err) => {
    section("ERRO");
    if (err instanceof Error) {
      console.error(err.message);
      if (err.stack) console.error("\n", err.stack);
    } else {
      console.error(err);
    }
    process.exit(1);
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      /* ignore */
    }
  });
