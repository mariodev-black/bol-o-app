import "dotenv/config";
import { runCartwaveDebugReport } from "@/lib/payments/cartwave/debug";

async function main() {
  const report = await runCartwaveDebugReport();
  console.log(JSON.stringify(report, null, 2));
  if (!report.auth.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
