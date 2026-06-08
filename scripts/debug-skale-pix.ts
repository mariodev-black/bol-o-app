import "dotenv/config";
import { createSkalePixTransaction } from "../lib/payments/skalepayments";

async function main() {
  const amountCents = Number(process.argv[2] || 5000);
  const result = await createSkalePixTransaction({
    amountCents,
    externalId: `debug_${Date.now()}`,
    customer: {
      name: process.env.DEBUG_SKALE_CUSTOMER_NAME || "Teste Bolao",
      email: process.env.DEBUG_SKALE_CUSTOMER_EMAIL || "teste@example.com",
      phone: process.env.DEBUG_SKALE_CUSTOMER_PHONE || "11999999999",
      document: process.env.DEBUG_SKALE_CUSTOMER_CPF || "12345678909",
    },
    itemTitle: "Debug PIX Skale",
  });

  console.log(
    JSON.stringify(
      {
        providerTransactionId: result.providerTransactionId,
        status: result.status,
        pixQrcodePreview: result.pixQrcode?.slice(0, 80),
        pixEnd2EndId: result.pixEnd2EndId,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
