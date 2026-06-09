import { createHmac, timingSafeEqual } from "node:crypto";
import { getPool } from "@/lib/db";
import { getEmailAppUrl } from "@/lib/email/config";

/**
 * Descadastro one-click (RFC 8058) exigido pelo Gmail/Yahoo para remetentes em massa.
 * Token HMAC stateless: não precisa de login nem lookup para validar.
 */

function unsubscribeSecret(): string {
  return (process.env.AUTH_SECRET || process.env.CRON_SECRET || "bolao-unsub").trim();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Token = HMAC-SHA256(email_normalizado) em hex. */
export function makeUnsubscribeToken(email: string): string {
  return createHmac("sha256", unsubscribeSecret())
    .update(normalizeEmail(email))
    .digest("hex");
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = makeUnsubscribeToken(email);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from((token || "").trim(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** URL HTTPS de descadastro one-click (usada no header List-Unsubscribe). */
export function buildUnsubscribeUrl(email: string): string {
  const e = encodeURIComponent(normalizeEmail(email));
  const t = makeUnsubscribeToken(email);
  return getEmailAppUrl(`/api/email/unsubscribe?e=${e}&t=${t}`);
}

/** Grava o descadastro (idempotente). Campanhas passam a pular este e-mail. */
export async function addEmailUnsubscribe(
  email: string,
  reason: string = "one_click",
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO email_unsubscribes (email_normalized, reason)
     VALUES ($1, $2)
     ON CONFLICT (email_normalized) DO NOTHING`,
    [normalizeEmail(email), reason],
  );
}

export async function isEmailUnsubscribed(email: string): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `SELECT 1 FROM email_unsubscribes WHERE email_normalized = $1`,
    [normalizeEmail(email)],
  );
  return (rowCount ?? 0) > 0;
}
