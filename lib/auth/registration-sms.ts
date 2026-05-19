/**
 * Envio de código de verificação no cadastro (WhatsApp via webhook SellFlux).
 *
 * Substitui o antigo Twilio (SMS). O código continua sendo gerado/persistido
 * pelo servidor (`registration_sms_codes`) — o webhook é só o canal de entrega.
 *
 * Convenção do SellFlux custom webhook (vide PAYMENT_APPROVED_WEBHOOK):
 *   - URL com query-string mapeando placeholders SellFlux para campos do body:
 *       ?name=customer.name&email=customer.email&phone=customer.phone
 *   - O body deve ter `customer.{name,email,phone}` para o SellFlux casar o
 *     contato. Campos adicionais (ex.: `code`, `message`) ficam disponíveis
 *     para uso em templates de mensagem.
 *
 * Nome do arquivo é histórico (`registration-sms.ts`); o canal real hoje é
 * WhatsApp. Mantido para evitar churn de imports.
 */
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { getPool } from "@/lib/db";

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_MIN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const WEBHOOK_DEFAULT_TIMEOUT_MS = 12_000;

let tableReady: Promise<void> | null = null;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function normalizeRegistrationPhoneE164(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length < 10) return "";
  return d.startsWith("55") && d.length >= 12 ? `+${d}` : `+55${d}`;
}

async function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      const pool = getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS registration_sms_codes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          phone_e164 TEXT NOT NULL,
          cpf TEXT NOT NULL,
          code_hash TEXT NOT NULL,
          attempts INT NOT NULL DEFAULT 0,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS registration_sms_codes_phone_created_idx
          ON registration_sms_codes (phone_e164, created_at DESC);
      `);
    })();
  }
  await tableReady;
}

function generateSixDigitCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Envia o código de verificação via webhook SellFlux (WhatsApp).
 *
 * Variáveis suportadas:
 *   - `REGISTRATION_WHATSAPP_WEBHOOK_URL` (obrigatória em produção)
 *   - `REGISTRATION_WHATSAPP_WEBHOOK_SECRET` (opcional → `Authorization: Bearer`)
 *   - `REGISTRATION_WHATSAPP_WEBHOOK_TIMEOUT_MS` (opcional, default 12000)
 *   - `SMS_APP_NAME` (label do app no texto, default "Bolão do Milhão")
 *
 * Falhas levantam exceção para o caller (`sendRegistrationSmsCode`) traduzir
 * em erro de usuário. Em dev/staging, se a env não estiver configurada, o
 * código aparece no console — facilita teste local sem WhatsApp real.
 */
async function sendRegistrationWhatsAppCode(input: {
  phoneE164: string;
  code: string;
  name: string | null;
  email: string | null;
}): Promise<void> {
  const url = process.env.REGISTRATION_WHATSAPP_WEBHOOK_URL?.trim();
  const appName = process.env.SMS_APP_NAME?.trim() || "Bolão do Milhão";

  if (!url) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[registration-whatsapp] REGISTRATION_WHATSAPP_WEBHOOK_URL não configurada — código apenas em log.",
      );
    }
    console.info(`[registration-whatsapp] código para ${input.phoneE164}: ${input.code}`);
    return;
  }

  const phoneDigits = input.phoneE164.replace(/\D/g, "");
  const message = `${appName}: seu código de confirmação é ${input.code}. Válido por 10 minutos.`;

  // Body alinhado ao padrão SellFlux custom webhook:
  //   ?name=customer.name&email=customer.email&phone=customer.phone
  // (mesma convenção usada em `payment-approved-webhook.ts`)
  const body = {
    event: "registration.verification_code",
    occurredAt: new Date().toISOString(),
    customer: {
      name: (input.name || "").trim() || "Cliente",
      email: (input.email || "").trim(),
      // SellFlux costuma normalizar o phone — enviamos somente dígitos (DDI+DDD+número).
      phone: phoneDigits,
    },
    code: input.code,
    message,
    appName,
  };

  const secret = process.env.REGISTRATION_WHATSAPP_WEBHOOK_SECRET?.trim();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers.Authorization = `Bearer ${secret}`;

  const timeoutRaw = process.env.REGISTRATION_WHATSAPP_WEBHOOK_TIMEOUT_MS?.trim();
  const timeoutMs = Math.min(60_000, Math.max(2_000, Number(timeoutRaw) || WEBHOOK_DEFAULT_TIMEOUT_MS));
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
      console.error("[registration-whatsapp] webhook non-ok", {
        status: res.status,
        statusText: res.statusText,
        snippet: text.slice(0, 300),
      });
      throw new Error("whatsapp_send_failed");
    }
  } catch (e) {
    if ((e as Error)?.name === "AbortError") {
      console.error("[registration-whatsapp] webhook timeout", { timeoutMs });
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function sendRegistrationSmsCode(input: {
  phoneE164: string;
  cpf: string;
  /** Nome (mascarado ou completo) usado pelo SellFlux para identificar o lead. */
  name?: string | null;
  /** Email já validado no passo anterior do cadastro. */
  email?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string; retryAfterSeconds?: number }> {
  await ensureTable();
  const pool = getPool();
  const phone = input.phoneE164.trim();
  const cpf = input.cpf.replace(/\D/g, "");

  const recent = await pool.query<{ created_at: Date }>(
    `SELECT created_at FROM registration_sms_codes
     WHERE phone_e164 = $1 AND cpf = $2
     ORDER BY created_at DESC LIMIT 1`,
    [phone, cpf],
  );
  const last = recent.rows[0]?.created_at;
  if (last) {
    const elapsed = Date.now() - last.getTime();
    if (elapsed < RESEND_MIN_MS) {
      return {
        ok: false,
        error: "Aguarde um momento antes de solicitar um novo código.",
        retryAfterSeconds: Math.ceil((RESEND_MIN_MS - elapsed) / 1000),
      };
    }
  }

  const code = generateSixDigitCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await pool.query(
    `INSERT INTO registration_sms_codes (phone_e164, cpf, code_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [phone, cpf, hashCode(code), expiresAt],
  );

  try {
    await sendRegistrationWhatsAppCode({
      phoneE164: phone,
      code,
      name: input.name ?? null,
      email: input.email ?? null,
    });
  } catch {
    return {
      ok: false,
      error: "Não foi possível enviar o código pelo WhatsApp. Tente novamente em instantes.",
    };
  }

  return { ok: true };
}

export async function verifyRegistrationSmsCode(input: {
  phoneE164: string;
  cpf: string;
  code: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureTable();
  const pool = getPool();
  const phone = input.phoneE164.trim();
  const cpf = input.cpf.replace(/\D/g, "");
  const code = input.code.replace(/\D/g, "");
  if (code.length !== 6) {
    return { ok: false, error: "Informe o código de 6 dígitos." };
  }

  const { rows } = await pool.query<{
    id: string;
    code_hash: string;
    attempts: number;
    expires_at: Date;
  }>(
    `SELECT id, code_hash, attempts, expires_at
     FROM registration_sms_codes
     WHERE phone_e164 = $1 AND cpf = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [phone, cpf],
  );

  const row = rows[0];
  if (!row) {
    return { ok: false, error: "Código não encontrado. Solicite um novo SMS." };
  }

  if (row.expires_at.getTime() < Date.now()) {
    return { ok: false, error: "Código expirado. Solicite um novo SMS." };
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Muitas tentativas. Solicite um novo código." };
  }

  const expected = Buffer.from(row.code_hash, "hex");
  const actual = Buffer.from(hashCode(code), "hex");
  const match =
    expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!match) {
    await pool.query(`UPDATE registration_sms_codes SET attempts = attempts + 1 WHERE id = $1`, [
      row.id,
    ]);
    return { ok: false, error: "Código incorreto. Verifique e tente novamente." };
  }

  await pool.query(`DELETE FROM registration_sms_codes WHERE phone_e164 = $1 AND cpf = $2`, [
    phone,
    cpf,
  ]);

  return { ok: true };
}
