/**
 * Testa criação de cash-in na 3xPay e mostra status retornados (debug falso "pago").
 * Uso: npm run debug:threexpay
 */
import { config as dotenvConfig } from "dotenv";
import {
  centsToGatewayAmount,
  isGatewayPaymentSettled,
  normalizeGatewayStatus,
  paymentWebhookUrl,
} from "../lib/payments/gateway";

dotenvConfig({ path: ".env" });

const amountCents = Number(process.env.DEBUG_THREEXPAY_AMOUNT_CENTS) || 100;
const apiUrl = (process.env.THREEXPAY_API_URL || "https://gateway.3xpay.co").replace(/\/+$/, "");
const apiKey = process.env.THREEXPAY_API_KEY?.trim();
const apiSecret = process.env.THREEXPAY_API_SECRET?.trim();

if (!apiKey || !apiSecret) {
  console.error("THREEXPAY_API_KEY / THREEXPAY_API_SECRET ausentes no .env");
  process.exit(1);
}

const externalId = `debug_${Date.now()}`;
const body = {
  transaction: {
    amount: centsToGatewayAmount(amountCents),
    callback_url: paymentWebhookUrl(),
    external_id: externalId,
    debtor: {
      name: process.env.DEBUG_THREEXPAY_DEBTOR_NAME || "Debug Bolao",
      document: (process.env.DEBUG_THREEXPAY_DEBTOR_CPF || "52998224725").replace(/\D/g, ""),
    },
    expiration: 3600,
  },
};

async function main() {
  console.log("POST", `${apiUrl}/transaction/cash-in`);
  console.log("external_id:", externalId);
  console.log("callback:", paymentWebhookUrl());

  const res = await fetch(`${apiUrl}/transaction/cash-in`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      api_key: apiKey!,
      api_secret: apiSecret!,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    console.error("Resposta não é JSON:", text.slice(0, 500));
    process.exit(1);
  }

  console.log("\nHTTP", res.status);
  console.log(JSON.stringify(json, null, 2));

  const topStatus = String(json.status ?? "");
  const payment =
    typeof json.payment === "object" && json.payment ? (json.payment as Record<string, unknown>) : null;
  const paymentStatus = payment?.status ? String(payment.status) : "";

  console.log("\n--- Interpretação (cash-in) ---");
  console.log("json.status (API):", topStatus || "(vazio)", "→ SUCCESS = criado, não pago");
  console.log("payment.status:", paymentStatus || "(vazio)", "→ PENDING = aguardando PIX");
  console.log("Status gravado no app:", "waiting_payment (sempre até webhook PAID)");
  console.log(
    "isGatewayPaymentSettled(top):",
    isGatewayPaymentSettled(topStatus),
    "← deve ser false para SUCCESS",
  );
  if (payment?.payment_code) {
    console.log("payment_code (PIX):", String(payment.payment_code).slice(0, 40) + "...");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
