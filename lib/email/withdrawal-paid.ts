import { findUserById } from "@/lib/auth/users";
import { parseTransactionalEmail } from "@/lib/email/address";
import { EMAIL_TAG_WITHDRAWAL_PAID } from "@/lib/email/policy";
import { sendEmail } from "@/lib/email/send";
import { buildWithdrawalPaidEmail } from "@/lib/email/templates/withdrawal-paid";

export async function sendWithdrawalPaidEmail(input: {
  userId: string;
  email: string;
  name?: string | null;
  amountLabel: string;
}): Promise<{ sent: boolean; error?: string; skipped?: boolean }> {
  const parsed = parseTransactionalEmail(input.email);
  if (!parsed.ok) {
    return { sent: false, error: parsed.error, skipped: true };
  }

  const user = await findUserById(input.userId);
  if (!user || user.email?.trim().toLowerCase() !== parsed.email.toLowerCase()) {
    return { sent: false, error: "Usuário não encontrado para e-mail de saque.", skipped: true };
  }

  const { subject, html, text } = buildWithdrawalPaidEmail({
    recipientName: input.name ?? user.name,
    amountLabel: input.amountLabel,
  });

  const result = await sendEmail({
    to: parsed.email,
    subject,
    html,
    text,
    category: EMAIL_TAG_WITHDRAWAL_PAID,
  });

  if (!result.ok) {
    return { sent: false, error: result.error };
  }
  return { sent: true };
}
