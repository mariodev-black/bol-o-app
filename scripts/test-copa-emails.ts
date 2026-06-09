/**
 * Envia um e-mail de cada campanha para o endereço de teste.
 *
 * Copa broadcast  → slot ter_12h ("R$29,90 pode virar R$1.000 + camisa")
 * PIX recovery    → step r04_12h_agressivo ("E se você acertar?")
 *
 * Run:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/test-copa-emails.ts
 *
 * Sobrescrever destinatário:
 *   TEST_EMAIL=outro@email.com npx tsx --tsconfig tsconfig.scripts.json scripts/test-copa-emails.ts
 */

import "dotenv/config";
import { bootstrapEmailOnStartup } from "@/lib/email/bootstrap";
import { sendEmail } from "@/lib/email/send";
import { COPA_BOLAO_EMAIL_BUILDERS } from "@/lib/email/templates/copa-bolao-2026";
import { PIX_RECOVERY_EMAIL_BUILDERS } from "@/lib/email/templates/pix-recovery-copa-2026";
import { EMAIL_TAG_CAMPAIGN_COPA_BOLAO, EMAIL_TAG_PIX_RECOVERY_COPA } from "@/lib/email/policy";

const TEST_EMAIL = process.env.TEST_EMAIL?.trim() || "lucasgabdsantos@gmail.com";
const TEST_NAME = "Lucas";

async function sendAndLog(label: string, result: Awaited<ReturnType<typeof sendEmail>>) {
  if (!result.ok) {
    console.error(`[FAIL] ${label}:`, result.error);
    process.exitCode = 1;
  } else if ("devLogged" in result) {
    console.info(`[DEV-LOG] ${label}: impresso no console (Resend não configurado)`);
  } else {
    console.info(`[OK] ${label}: resend_id=${result.id}`);
  }
}

async function main() {
  console.info("Destinatário:", TEST_EMAIL);
  console.info("─".repeat(50));

  await bootstrapEmailOnStartup();

  // ── 1. Copa broadcast — slot ter_12h ────────────────────────────────────
  {
    const builder = COPA_BOLAO_EMAIL_BUILDERS["ter_12h"]!;
    const email = builder({ recipientName: TEST_NAME });
    console.info("\n[1/2] Copa broadcast — ter_12h");
    console.info("Assunto:", email.subject);
    const result = await sendEmail({
      to: TEST_EMAIL,
      subject: email.subject,
      html: email.html,
      text: email.text,
      category: EMAIL_TAG_CAMPAIGN_COPA_BOLAO,
      kind: "marketing",
    });
    await sendAndLog("Copa broadcast ter_12h", result);
  }

  // Pequena pausa para não rejeitar pelo rate-limit do Resend
  await new Promise((r) => setTimeout(r, 1500));

  // ── 2. PIX Recovery — step r04_12h_agressivo ────────────────────────────
  {
    const builder = PIX_RECOVERY_EMAIL_BUILDERS["r04_12h_agressivo"]!;
    const email = builder({ recipientName: TEST_NAME });
    console.info("\n[2/2] PIX Recovery — r04_12h_agressivo");
    console.info("Assunto:", email.subject);
    const result = await sendEmail({
      to: TEST_EMAIL,
      subject: email.subject,
      html: email.html,
      text: email.text,
      category: EMAIL_TAG_PIX_RECOVERY_COPA,
      kind: "marketing",
    });
    await sendAndLog("PIX recovery r04_12h_agressivo", result);
  }

  console.info("\n─".repeat(50));
  console.info("Teste concluído.");
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
