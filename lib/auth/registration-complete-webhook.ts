/**
 * Notifica o SellFlux quando o cadastro (senha) é concluído com sucesso.
 *
 * URL esperada (query mapeia o body):
 *   ?name=customer.name&email=customer.email&phone=customer.phone
 *
 * Env: `REGISTRATION_COMPLETED_WEBHOOK_URL` (obrigatória para enviar)
 * Opcional: `REGISTRATION_COMPLETED_WEBHOOK_SECRET`, `REGISTRATION_COMPLETED_WEBHOOK_TIMEOUT_MS`
 */

const WEBHOOK_DEFAULT_TIMEOUT_MS = 12_000;

export type RegistrationCompletedWebhookInput = {
  name: string;
  email: string;
  phoneE164: string;
};

/**
 * POST com name, email e phone — falha só gera log (não bloqueia o cadastro).
 */
export async function postRegistrationCompletedWebhook(
  input: RegistrationCompletedWebhookInput,
): Promise<void> {
  const url = process.env.REGISTRATION_COMPLETED_WEBHOOK_URL?.trim();
  if (!url) return;

  const phoneDigits = input.phoneE164.replace(/\D/g, "");
  const body = {
    event: "registration.completed",
    occurredAt: new Date().toISOString(),
    customer: {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: phoneDigits,
    },
  };

  const secret = process.env.REGISTRATION_COMPLETED_WEBHOOK_SECRET?.trim();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers.Authorization = `Bearer ${secret}`;

  const timeoutRaw = process.env.REGISTRATION_COMPLETED_WEBHOOK_TIMEOUT_MS?.trim();
  const timeoutMs = Math.min(
    60_000,
    Math.max(2_000, Number(timeoutRaw) || WEBHOOK_DEFAULT_TIMEOUT_MS),
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[registration-complete-webhook] non-ok", {
        status: res.status,
        statusText: res.statusText,
        snippet: text.slice(0, 300),
      });
    }
  } catch (e) {
    console.error("[registration-complete-webhook] request failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  } finally {
    clearTimeout(timer);
  }
}
