/**
 * Valida variáveis necessárias para e-mail e cadastro em produção.
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/check-email-env.ts
 *
 * No servidor, o mesmo check roda automaticamente em `instrumentation.ts` (boot).
 */
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env" });

import {
  getEmailEnvChecks,
  getEmailEnvProductionFailures,
} from "../lib/email/env-check";

const isProd = process.env.NODE_ENV === "production";

console.info(`[check-email-env] NODE_ENV=${process.env.NODE_ENV ?? "development"}\n`);

for (const c of getEmailEnvChecks()) {
  const mark = c.ok ? "OK" : isProd && c.requiredInProduction ? "FALTA" : "aviso";
  console.info(`  [${mark}] ${c.name}${c.hint && !c.ok ? ` — ${c.hint}` : ""}`);
}

const logoBase = (process.env.APP_URL ?? "").replace(/\/+$/, "");
if (logoBase.startsWith("http")) {
  console.info(`\n  Logo e-mail: ${logoBase}/email/logo-email.png`);
}

const failures = getEmailEnvProductionFailures();
console.info("");
if (failures.length > 0) {
  console.error(
    `[check-email-env] ${failures.length} variável(is) obrigatória(s) em produção.`,
  );
  process.exit(1);
}
console.info("[check-email-env] Pronto para produção (e-mail + WhatsApp cadastro).");
