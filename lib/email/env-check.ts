export type EmailEnvCheck = {
  name: string;
  ok: boolean;
  hint?: string;
  /** Obrigatório em produção para envio Resend. */
  requiredInProduction?: boolean;
};

export function getEmailEnvChecks(): EmailEnvCheck[] {
  return [
    {
      name: "APP_URL",
      ok: Boolean(process.env.APP_URL?.trim()?.startsWith("http")),
      hint: "Ex.: https://app.bolaodomilhao.com.br",
      requiredInProduction: true,
    },
    {
      name: "RESEND_API_KEY",
      ok: Boolean(process.env.RESEND_API_KEY?.trim()),
      hint: "Painel Resend",
      requiredInProduction: true,
    },
    {
      name: "EMAIL_FROM",
      ok: Boolean(
        process.env.EMAIL_FROM?.trim() || process.env.RESEND_FROM?.trim(),
      ),
      hint: "Ex.: Bolão do Milhão <noreply@mail.dominio.com.br>",
      requiredInProduction: true,
    },
    {
      name: "REGISTRATION_WHATSAPP_WEBHOOK_URL",
      ok: Boolean(process.env.REGISTRATION_WHATSAPP_WEBHOOK_URL?.trim()),
      hint: "SellFlux — código de cadastro",
      requiredInProduction: true,
    },
    {
      name: "AUTH_SECRET",
      ok: (process.env.AUTH_SECRET?.trim().length ?? 0) >= 32,
      hint: "Mín. 32 caracteres",
      requiredInProduction: true,
    },
    {
      name: "CRON_SECRET",
      ok: Boolean(process.env.CRON_SECRET?.trim()),
      hint: "Cron HTTP (campanhas, sync)",
      requiredInProduction: false,
    },
  ];
}

export function getEmailEnvProductionFailures(): EmailEnvCheck[] {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) return [];
  return getEmailEnvChecks().filter((c) => c.requiredInProduction && !c.ok);
}
