import { findUserByEmail } from "@/lib/auth/users";
import { parseTransactionalEmail } from "@/lib/email/address";
import { sendEmail } from "@/lib/email/send";
import { EMAIL_TAG_WELCOME } from "@/lib/email/policy";
import { buildWelcomeEmail } from "@/lib/email/templates/welcome";

/**
 * Boas-vindas após cadastro concluído (único e-mail transacional do cadastro).
 * Só envia se o usuário existir no banco com o mesmo e-mail.
 */
export async function sendWelcomeEmail(input: {
  email: string;
  name?: string | null;
  /** ID do usuário recém-criado — garante que o e-mail pertence à conta certa. */
  userId?: string;
}): Promise<{ sent: boolean; error?: string; skipped?: boolean }> {
  const parsed = parseTransactionalEmail(input.email);
  if (!parsed.ok) {
    return { sent: false, error: parsed.error, skipped: true };
  }

  const user = await findUserByEmail(parsed.email);
  if (!user) {
    console.warn("[email] welcome skipped — usuário não encontrado", {
      email: parsed.email,
    });
    return { sent: false, error: "Usuário não encontrado para envio de boas-vindas.", skipped: true };
  }

  if (input.userId && user.id !== input.userId) {
    console.warn("[email] welcome skipped — e-mail não corresponde ao userId", {
      email: parsed.email,
      userId: input.userId,
    });
    return { sent: false, error: "E-mail não corresponde à conta criada.", skipped: true };
  }

  const { subject, html, text } = buildWelcomeEmail({
    recipientName: input.name ?? user.name,
  });

  const result = await sendEmail({
    to: parsed.email,
    subject,
    html,
    text,
    category: EMAIL_TAG_WELCOME,
  });

  if (!result.ok) {
    console.error("[email] welcome failed", { email: parsed.email, error: result.error });
    return { sent: false, error: result.error };
  }

  if ("devLogged" in result && result.devLogged) {
    console.info("[email] welcome dev-logged", { email: parsed.email, subject });
  } else if ("id" in result) {
    console.info("[email] welcome sent", { email: parsed.email, id: result.id, userId: user.id });
  }

  return { sent: true };
}
