import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { hashPassword } from "@/lib/auth/password";
import { userExistsByEmail } from "@/lib/auth/user-email";
import { findUserByEmail, updateUserPasswordHash } from "@/lib/auth/users";
import { parseTransactionalEmail } from "@/lib/email/address";
import { sendPasswordResetCodeEmail } from "@/lib/email/password-reset";
import { PASSWORD_RESET_CODE_TTL_MS } from "@/lib/email/constants";
import { getPool } from "@/lib/db";

const RESEND_MIN_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export const PASSWORD_RESET_CODE_MAX_ATTEMPTS = MAX_ATTEMPTS;
export const PASSWORD_RESET_RESEND_COOLDOWN_SECONDS = Math.round(RESEND_MIN_MS / 1000);

let tableReady: Promise<void> | null = null;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

async function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      const pool = getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS password_reset_codes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT NOT NULL,
          code_hash TEXT NOT NULL,
          attempts INT NOT NULL DEFAULT 0,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS password_reset_codes_email_created_idx
          ON password_reset_codes (lower(trim(email)), created_at DESC);
      `);
    })();
  }
  await tableReady;
}

function generateSixDigitCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export type SendPasswordResetCodeResult =
  | { ok: true; emailSent: true }
  | { ok: false; error: string; retryAfterSeconds?: number; reason?: "not_found" | "invalid_email" | "send_failed" };

/**
 * Envia código por e-mail somente se o e-mail existir em `users`.
 */
export async function sendPasswordResetCode(
  emailRaw: string,
): Promise<SendPasswordResetCodeResult> {
  await ensureTable();

  const parsed = parseTransactionalEmail(emailRaw);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, reason: "invalid_email" };
  }
  const email = parsed.email;

  const exists = await userExistsByEmail(email);
  if (!exists) {
    return {
      ok: false,
      error: "Não encontramos uma conta com este e-mail. Verifique o endereço ou cadastre-se.",
      reason: "not_found",
    };
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return {
      ok: false,
      error: "Não encontramos uma conta com este e-mail. Verifique o endereço ou cadastre-se.",
      reason: "not_found",
    };
  }

  const pool = getPool();
  const recent = await pool.query<{ created_at: Date }>(
    `SELECT created_at FROM password_reset_codes
     WHERE lower(trim(email)) = $1
     ORDER BY created_at DESC LIMIT 1`,
    [email],
  );
  const last = recent.rows[0]?.created_at;
  if (last) {
    const elapsed = Date.now() - last.getTime();
    if (elapsed < RESEND_MIN_MS) {
      const retryAfterSeconds = Math.ceil((RESEND_MIN_MS - elapsed) / 1000);
      const minutes = Math.ceil(retryAfterSeconds / 60);
      return {
        ok: false,
        error: `Aguarde ${minutes} minuto${minutes > 1 ? "s" : ""} antes de solicitar um novo código.`,
        retryAfterSeconds,
      };
    }
  }

  const code = generateSixDigitCode();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_CODE_TTL_MS);

  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO password_reset_codes (email, code_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [email, hashCode(code), expiresAt],
  );
  const codeRowId = inserted.rows[0]?.id;

  const emailResult = await sendPasswordResetCodeEmail({
    email,
    code,
    name: user.name,
  });

  if (!emailResult.ok) {
    if (codeRowId) {
      await pool.query(`DELETE FROM password_reset_codes WHERE id = $1`, [codeRowId]);
    }
    console.error("[password-reset] e-mail não enviado", { email, error: emailResult.error });
    return {
      ok: false,
      error: "Não foi possível enviar o código por e-mail. Tente novamente em instantes.",
      reason: "send_failed",
    };
  }

  console.info("[password-reset] código enviado", { email });
  return { ok: true, emailSent: true };
}

export type VerifyPasswordResetCodeResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      attemptsRemaining?: number;
      locked?: boolean;
      reason?: "not_found" | "invalid_email";
    };

export async function verifyPasswordResetCode(input: {
  email: string;
  code: string;
}): Promise<VerifyPasswordResetCodeResult> {
  await ensureTable();

  const parsed = parseTransactionalEmail(input.email);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, reason: "invalid_email" };
  }
  const email = parsed.email;

  if (!(await userExistsByEmail(email))) {
    return {
      ok: false,
      error: "Não encontramos uma conta com este e-mail.",
      reason: "not_found",
    };
  }

  const code = input.code.replace(/\D/g, "");
  if (code.length !== 6) {
    return { ok: false, error: "Informe o código de 6 dígitos." };
  }

  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    code_hash: string;
    attempts: number;
    expires_at: Date;
  }>(
    `SELECT id, code_hash, attempts, expires_at
     FROM password_reset_codes
     WHERE lower(trim(email)) = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [email],
  );

  const row = rows[0];
  if (!row) {
    return {
      ok: false,
      error: "Código não encontrado. Solicite um novo código por e-mail.",
      locked: true,
    };
  }

  if (row.expires_at.getTime() < Date.now()) {
    return {
      ok: false,
      error: "Código expirado. Solicite um novo código por e-mail.",
      locked: true,
    };
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    return {
      ok: false,
      error: "Muitas tentativas erradas. Solicite um novo código por e-mail.",
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
    await pool.query(`UPDATE password_reset_codes SET attempts = $1 WHERE id = $2`, [
      next,
      row.id,
    ]);
    const remaining = Math.max(0, MAX_ATTEMPTS - next);
    if (remaining === 0) {
      return {
        ok: false,
        error: "Muitas tentativas erradas. Solicite um novo código por e-mail.",
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

  return { ok: true };
}

export async function resetPasswordWithCode(input: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<VerifyPasswordResetCodeResult | { ok: true }> {
  const parsed = parseTransactionalEmail(input.email);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, reason: "invalid_email" };
  }
  const email = parsed.email;

  const user = await findUserByEmail(email);
  if (!user) {
    return {
      ok: false,
      error: "Não encontramos uma conta com este e-mail.",
      reason: "not_found",
    };
  }

  const verify = await verifyPasswordResetCode({ email, code: input.code });
  if (!verify.ok) {
    return verify;
  }

  const passwordHash = await hashPassword(input.newPassword);
  const updated = await updateUserPasswordHash(user.id, passwordHash);
  if (!updated) {
    return { ok: false, error: "Não foi possível atualizar a senha. Tente novamente." };
  }

  const pool = getPool();
  await pool.query(`DELETE FROM password_reset_codes WHERE lower(trim(email)) = $1`, [email]);

  return { ok: true };
}
