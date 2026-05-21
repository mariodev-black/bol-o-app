/**
 * Confirmação do cadastro — APENAS WhatsApp (SellFlux).
 *
 * Para avançar no cadastro o usuário precisa do código enviado por este webhook.
 * E-mail (Resend) não participa desta etapa; boas-vindas vão em `sendWelcomeEmail`
 * após `POST /api/auth/register`.
 *
 * O código é gerado/persistido em `registration_sms_codes`; o webhook só entrega.
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

/** Tempo de vida do código emitido (10 minutos). */
const CODE_TTL_MS = 10 * 60 * 1000;
/** Reenvios imediatos (sem espera) após o 1º envio; depois disso vale o cooldown. */
const REGISTRATION_FREE_RESENDS = 3;
/** Total de envios na janela do código (1º + reenvios gratuitos) antes do cooldown. */
const REGISTRATION_SENDS_BEFORE_COOLDOWN = 1 + REGISTRATION_FREE_RESENDS;
/**
 * Cooldown entre reenvios após esgotar os gratuitos (5 minutos).
 * Backend é a fonte da verdade: o front recebe `retryAfterSeconds` quando rejeitado.
 */
const RESEND_MIN_MS = 5 * 60 * 1000;
/** Máximo de tentativas erradas antes de bloquear o código atual. */
const MAX_ATTEMPTS = 5;
const WEBHOOK_DEFAULT_TIMEOUT_MS = 12_000;

/** Exporta o limite (front usa para mensagens "X tentativas restantes"). */
export const REGISTRATION_CODE_MAX_ATTEMPTS = MAX_ATTEMPTS;
export const REGISTRATION_CODE_FREE_RESENDS = REGISTRATION_FREE_RESENDS;
export const REGISTRATION_CODE_SENDS_BEFORE_COOLDOWN = REGISTRATION_SENDS_BEFORE_COOLDOWN;
/** Cooldown em segundos — após esgotar reenvios gratuitos. */
export const REGISTRATION_CODE_RESEND_COOLDOWN_SECONDS = Math.round(RESEND_MIN_MS / 1000);

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

/** Sempre 6 caracteres decimais (inclui zeros à esquerda, ex.: "042918"). */
function generateSixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Normaliza para envio/display — evita perda de dígito no SellFlux (número vs string). */
function normalizeSixDigitCode(code: string): string {
  const digits = code.replace(/\D/g, "");
  if (digits.length >= 6) return digits.slice(-6);
  return digits.padStart(6, "0");
}

/**
 * SellFlux custom webhook: query `?name=customer.name&...` mapeia campos do JSON.
 * Sem `codigo`/`message` na URL o template pode usar variável numérica e cortar
 * o zero à esquerda (5 dígitos no WhatsApp).
 */
function augmentRegistrationWebhookUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const mappings: [string, string][] = [
      ["codigo", "codigo"],
      ["code", "code"],
      ["message", "message"],
      ["verification_code", "verification_code"],
    ];
    for (const [param, path] of mappings) {
      if (!u.searchParams.has(param)) u.searchParams.set(param, path);
    }
    return u.toString();
  } catch {
    return rawUrl;
  }
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
  const code = normalizeSixDigitCode(input.code);
  const message = `${appName}: seu código de confirmação é ${code}. Válido por 10 minutos.`;

  // Body alinhado ao padrão SellFlux custom webhook:
  //   ?name=customer.name&email=customer.email&phone=customer.phone
  //   &codigo=codigo&message=message (adicionados em augmentRegistrationWebhookUrl)
  // Campos duplicados como string para o template não tratar `codigo` como número.
  const body = {
    event: "registration.verification_code",
    occurredAt: new Date().toISOString(),
    customer: {
      name: (input.name || "").trim() || "Cliente",
      email: (input.email || "").trim(),
      phone: phoneDigits,
      verification_code: code,
    },
    codigo: code,
    code,
    verification_code: code,
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
    const webhookUrl = augmentRegistrationWebhookUrl(url);
    const res = await fetch(webhookUrl, {
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
}): Promise<
  | { ok: true; resendsRemaining: number; cooldownSeconds: number }
  | { ok: false; error: string; retryAfterSeconds?: number }
> {
  await ensureTable();
  const pool = getPool();
  const phone = input.phoneE164.trim();
  const cpf = input.cpf.replace(/\D/g, "");

  const recent = await pool.query<{ n: string; last_at: Date | null }>(
    `SELECT COUNT(*)::text AS n, MAX(created_at) AS last_at
     FROM registration_sms_codes
     WHERE phone_e164 = $1 AND cpf = $2
       AND created_at > now() - ($3::bigint * interval '1 millisecond')`,
    [phone, cpf, CODE_TTL_MS],
  );
  const sendCount = Number.parseInt(recent.rows[0]?.n ?? "0", 10) || 0;
  const lastAt = recent.rows[0]?.last_at ?? null;
  const elapsedSinceLastMs = lastAt ? Date.now() - lastAt.getTime() : Number.POSITIVE_INFINITY;
  /** Após 5 min sem envio, recomeça a leva de reenvios gratuitos. */
  const sendsInCurrentBurst =
    lastAt && elapsedSinceLastMs >= RESEND_MIN_MS ? 0 : sendCount;

  if (
    sendsInCurrentBurst >= REGISTRATION_SENDS_BEFORE_COOLDOWN &&
    lastAt &&
    elapsedSinceLastMs < RESEND_MIN_MS
  ) {
    const retryAfterSeconds = Math.ceil((RESEND_MIN_MS - elapsedSinceLastMs) / 1000);
    const minutes = Math.ceil(retryAfterSeconds / 60);
    return {
      ok: false,
      error: `Você já usou os ${REGISTRATION_FREE_RESENDS} reenvios. Aguarde ${minutes} minuto${minutes > 1 ? "s" : ""} para solicitar outro código.`,
      retryAfterSeconds,
    };
  }

  const code = generateSixDigitCode();
  if (code.length !== 6) {
    console.error("[registration-whatsapp] código gerado com tamanho inválido", {
      length: code.length,
    });
    return { ok: false, error: "Não foi possível gerar o código. Tente novamente." };
  }
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

  const sendsAfterThis = sendsInCurrentBurst + 1;
  const resendsRemaining = Math.max(0, REGISTRATION_SENDS_BEFORE_COOLDOWN - sendsAfterThis);
  const cooldownSeconds =
    sendsAfterThis >= REGISTRATION_SENDS_BEFORE_COOLDOWN
      ? REGISTRATION_CODE_RESEND_COOLDOWN_SECONDS
      : 0;

  return { ok: true, resendsRemaining, cooldownSeconds };
}

/**
 * Resultado da verificação:
 *   - `ok: true`             → código válido (e DELETE do registro).
 *   - `attemptsRemaining`    → presente quando o erro é "código incorreto";
 *                              0 indica que o código atual foi BLOQUEADO
 *                              (precisa solicitar um novo via reenvio).
 *   - `locked: true`         → tentativas esgotadas / não existe código
 *                              ativo / código expirado — usuário PRECISA
 *                              clicar em "Reenviar código".
 */
export type VerifyRegistrationSmsCodeResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      attemptsRemaining?: number;
      locked?: boolean;
    };

export async function verifyRegistrationSmsCode(input: {
  phoneE164: string;
  cpf: string;
  code: string;
}): Promise<VerifyRegistrationSmsCodeResult> {
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
    return {
      ok: false,
      error: "Código não encontrado. Solicite um novo código pelo WhatsApp.",
      locked: true,
    };
  }

  if (row.expires_at.getTime() < Date.now()) {
    return {
      ok: false,
      error: "Código expirado. Solicite um novo código pelo WhatsApp.",
      locked: true,
    };
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    return {
      ok: false,
      error: "Muitas tentativas erradas. Solicite um novo código pelo WhatsApp.",
      attemptsRemaining: 0,
      locked: true,
    };
  }

  const expected = Buffer.from(row.code_hash, "hex");
  const actual = Buffer.from(hashCode(code), "hex");
  const match =
    expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!match) {
    const next = row.attempts + 1;
    await pool.query(`UPDATE registration_sms_codes SET attempts = $1 WHERE id = $2`, [
      next,
      row.id,
    ]);
    const remaining = Math.max(0, MAX_ATTEMPTS - next);
    if (remaining === 0) {
      return {
        ok: false,
        error: "Muitas tentativas erradas. Solicite um novo código pelo WhatsApp.",
        attemptsRemaining: 0,
        locked: true,
      };
    }
    return {
      ok: false,
      error: `Código incorreto. Você ainda tem ${remaining} tentativa${remaining > 1 ? "s" : ""}.`,
      attemptsRemaining: remaining,
    };
  }

  await pool.query(`DELETE FROM registration_sms_codes WHERE phone_e164 = $1 AND cpf = $2`, [
    phone,
    cpf,
  ]);

  return { ok: true };
}
