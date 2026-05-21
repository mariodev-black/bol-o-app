import { parseTransactionalEmail } from "@/lib/email/address";
import { sendEmail } from "@/lib/email/send";
import { EMAIL_TAG_PASSWORD_RESET } from "@/lib/email/policy";
import { PASSWORD_RESET_CODE_TTL_MINUTES } from "@/lib/email/constants";
import { buildPasswordResetCodeEmail } from "@/lib/email/templates/password-reset-code";

export async function sendPasswordResetCodeEmail(input: {
  email: string;
  code: string;
  name?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = parseTransactionalEmail(input.email);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const { subject, html, text } = buildPasswordResetCodeEmail({
    code: input.code,
    recipientName: input.name ?? null,
    expiresMinutes: PASSWORD_RESET_CODE_TTL_MINUTES,
  });

  const result = await sendEmail({
    to: parsed.email,
    subject,
    html,
    text,
    category: EMAIL_TAG_PASSWORD_RESET,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true };
}
