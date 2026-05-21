import { getEmailFrom, getEmailReplyTo, isResendConfigured } from "@/lib/email/config";
import { getResendClient } from "@/lib/email/client";
import { getEmailLogoAttachmentForResend } from "@/lib/email/logo-embed";
import type { ResendEmailCategory } from "@/lib/email/policy";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Categoria obrigatória — ver `lib/email/policy.ts` (só welcome e password_reset). */
  category: ResendEmailCategory;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: true; devLogged: true }
  | { ok: false; error: string };

/**
 * Envia e-mail via Resend. Sem `RESEND_API_KEY` / `EMAIL_FROM`, em não-produção
 * apenas registra no console (mesmo padrão do WhatsApp de cadastro).
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const to = input.to.trim();
  if (!to) {
    return { ok: false, error: "Destinatário inválido." };
  }

  if (!isResendConfigured()) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[email] RESEND_API_KEY ou EMAIL_FROM ausente — e-mail não enviado.");
      return { ok: false, error: "Serviço de e-mail indisponível." };
    }
    console.info(`[email] dev — to=${to} subject=${input.subject}`);
    console.info(`[email] dev — text:\n${input.text}`);
    return { ok: true, devLogged: true };
  }

  const from = getEmailFrom()!;
  const client = getResendClient();
  if (!client) {
    return { ok: false, error: "Cliente de e-mail indisponível." };
  }

  const logoAttachment = getEmailLogoAttachmentForResend();
  const attachments = logoAttachment ? [logoAttachment] : undefined;

  const { data, error } = await client.emails.send({
    from,
    to: [to],
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: getEmailReplyTo(),
    attachments,
    tags: [
      { name: "category", value: input.category },
      { name: "app", value: "bolao-do-milhao" },
    ],
  });

  if (error) {
    console.error("[email] resend error", { message: error.message, name: error.name });
    return { ok: false, error: error.message || "Falha ao enviar e-mail." };
  }

  return { ok: true, id: data?.id ?? "unknown" };
}
