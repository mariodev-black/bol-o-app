import {
  COPA_SLOT_IDS,
  runCopaBolaoSlot,
} from "@/lib/email/campaigns/copa-bolao-2026";
import { runPixRecoveryCopa } from "@/lib/email/campaigns/pix-recovery-copa-2026";
import { runAllCrmFlows } from "@/lib/email/campaigns/crm-flows";

/**
 * Disparo INTERNO das campanhas de e-mail (VPS self-hosted, sem Vercel cron).
 * Chamado pelo scheduler-v2 a cada tick; throttle interno limita a frequência real.
 *
 * Tudo é idempotente: advisory locks + tabelas de dedup. Rodar a mais não duplica.
 * Cada runner se auto-gateia por janela (slots da Copa por data/hora BRT, recovery
 * e CRM por janela de tempo desde o evento).
 */

let lastTickAt = 0;
let running = false;

/** Kill-switch só dos e-mails (não afeta o worker de futebol). Default: ligado. */
function emailCronEnabled(): boolean {
  const raw = (process.env.EMAIL_CRON_ENABLED || "").trim().toLowerCase();
  if (raw === "" ) return true; // default on
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function tickIntervalMs(): number {
  const raw = Number.parseInt(
    (process.env.EMAIL_CRON_INTERVAL_MINUTES || "").trim(),
    10,
  );
  const minutes = Number.isFinite(raw) && raw >= 1 ? raw : 10;
  return minutes * 60_000;
}

export async function maybeRunEmailCron(): Promise<void> {
  if (!emailCronEnabled()) return;
  if (running) return;
  const now = Date.now();
  if (now - lastTickAt < tickIntervalMs()) return;
  running = true;
  lastTickAt = now;

  try {
    // 1. CRM por evento (upsell, indique, prova social, recuperação de checkout).
    try {
      await runAllCrmFlows();
    } catch (err) {
      console.error("[email-cron] crm flows falhou:", err);
    }

    // 2. Recuperação de PIX abandonado (auto-gateia por janela de tempo).
    try {
      await runPixRecoveryCopa();
    } catch (err) {
      console.error("[email-cron] pix recovery falhou:", err);
    }

    // 3. Broadcast Copa — cada slot só dispara na sua data/hora BRT.
    try {
      for (const slot of COPA_SLOT_IDS) {
        await runCopaBolaoSlot(slot);
      }
    } catch (err) {
      console.error("[email-cron] copa broadcast falhou:", err);
    }
  } finally {
    running = false;
  }
}
