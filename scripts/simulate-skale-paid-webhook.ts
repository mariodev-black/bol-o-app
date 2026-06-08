import "dotenv/config";

const providerTransactionId = process.argv[2]?.trim();
const end2EndId = process.argv[3]?.trim() || `E_SIM_${Date.now()}`;
const baseUrl = (process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");

async function main() {
  if (!providerTransactionId) {
    console.error("Uso: npm run simulate:skale-paid -- <providerTransactionId> [end2EndId]");
    process.exit(1);
  }

  const response = await fetch(`${baseUrl}/api/webhooks/skale`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: providerTransactionId,
      status: "paid",
      end2EndId,
    }),
  });

  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    // keep raw text
  }

  console.log(JSON.stringify({ status: response.status, body }, null, 2));
  if (!response.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
