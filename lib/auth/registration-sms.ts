import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { getPool } from "@/lib/db";

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_MIN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

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

async function sendSmsMessage(phoneE164: string, code: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_SMS_FROM?.trim();
  const appName = process.env.SMS_APP_NAME?.trim() || "Bolão do Milhão";

  if (accountSid && authToken && from) {
    const body = encodeURIComponent(`${appName}: seu código de confirmação é ${code}. Válido por 10 minutos.`);
    const to = encodeURIComponent(phoneE164);
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `To=${to}&From=${encodeURIComponent(from)}&Body=${body}`,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[registration-sms] Twilio error", res.status, text.slice(0, 200));
      throw new Error("sms_send_failed");
    }
    return;
  }

  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[registration-sms] TWILIO_* não configurado; SMS não enviado (somente log em dev).",
    );
  }
  console.info(`[registration-sms] código para ${phoneE164}: ${code}`);
}

export async function sendRegistrationSmsCode(input: {
  phoneE164: string;
  cpf: string;
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
    await sendSmsMessage(phone, code);
  } catch {
    return { ok: false, error: "Não foi possível enviar o SMS. Tente novamente em instantes." };
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
