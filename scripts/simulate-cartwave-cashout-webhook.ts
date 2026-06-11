import "dotenv/config";

/**
 * Simula webhook Cartwave cash-out localmente.
 * Uso: npx tsx --tsconfig tsconfig.scripts.json scripts/simulate-cartwave-cashout-webhook.ts <withdrawalId> [PIX_CASHOUT_SUCCESS|PIX_CASHOUT_ERROR]
 */
async function main() {
  const withdrawalId = process.argv[2]?.trim();
  const eventType = (process.argv[3]?.trim() || "PIX_CASHOUT_SUCCESS") as string;
  if (!withdrawalId) {
    console.error("Uso: simulate-cartwave-cashout-webhook.ts <withdrawalId> [eventType]");
    process.exit(1);
  }

  const baseUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  const secret = (process.env.CARTWAVE_WEBHOOK_SECRET ?? "").trim();

  const payload =
    eventType === "PIX_CASHOUT_ERROR"
      ? {
          type: "PIX_CASHOUT_ERROR",
          data: {
            worked: true,
            transaction_id: 999001,
            status: "ERROR",
            amount: 50,
            tag: `bolao-withdraw:${withdrawalId}`,
            error: "Simulacao local de erro PIX",
          },
        }
      : {
          type: "PIX_CASHOUT_SUCCESS",
          data: {
            worked: true,
            transaction_id: 999001,
            end_to_end: "E355352402000000SIMULATED",
            status: "SUCCESS",
            amount: 50,
            payment_date: new Date().toISOString(),
            tag: `bolao-withdraw:${withdrawalId}`,
          },
        };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers.Authorization = `Bearer ${secret}`;

  const res = await fetch(`${baseUrl}/api/webhooks/cartwave`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  console.log(res.status, text);
  if (!res.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
