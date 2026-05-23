import { getEmailEnvChecks, getEmailEnvProductionFailures } from "@/lib/email/env-check";
import { ensureEmailCampaignTables } from "@/lib/email/campaign-sends";

let bootstrapped = false;

/**
 * No boot do Node: cria tabelas de campanha (IF NOT EXISTS) e registra env de e-mail.
 * Não exige `npm run db:email-campaign` nem `check:email-env` manual.
 */
export async function bootstrapEmailOnStartup(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  try {
    await ensureEmailCampaignTables();
    console.info("[email] campanhas — tabelas email_campaign_* prontas");
  } catch (error) {
    console.error("[email] campanhas — falha ao garantir tabelas", error);
  }

  const isProd = process.env.NODE_ENV === "production";
  const failures = getEmailEnvProductionFailures();

  for (const c of getEmailEnvChecks()) {
    const mark = c.ok ? "ok" : isProd && c.requiredInProduction ? "falta" : "aviso";
    if (!c.ok) {
      console.warn(`[email] env [${mark}] ${c.name}${c.hint ? ` — ${c.hint}` : ""}`);
    }
  }

  if (failures.length > 0) {
    console.error(
      `[email] produção: ${failures.length} variável(is) ausente(s) — envio Resend/cadastro podem falhar`,
    );
  } else if (isProd) {
    console.info("[email] produção — variáveis de e-mail/WhatsApp OK");
  }
}
