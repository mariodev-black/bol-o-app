import { getEmailFrom, getEmailReplyTo, isResendConfigured } from "@/lib/email/config";
import { getResendClient } from "@/lib/email/client";
import {
  buildMarketingEmailHeaders,
  getEmailMarketingFrom,
} from "@/lib/email/deliverability";
import { getEmailLogoAttachmentForResend } from "@/lib/email/logo-embed";
import type { ResendEmailCategory } from "@/lib/email/policy";

export type SendEmailKind = "transactional" | "marketing";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Categoria obrigatória — ver `lib/email/policy.ts`. */
  category: ResendEmailCategory;
  /**
   * `marketing` — campanhas em massa: remetente contato@, List-Unsubscribe, sem anexo CID.
   * `transactional` (padrão) — boas-vindas, senha.
   */
  kind?: SendEmailKind;
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

  const kind = input.kind ?? "transactional";
  const from =
    kind === "marketing"
      ? getEmailMarketingFrom() ?? getEmailFrom()
      : getEmailFrom();
  if (!from) {
    return { ok: false, error: "EMAIL_FROM não configurado." };
  }

  const replyTo = getEmailReplyTo();
  if (kind === "marketing" && !replyTo) {
    console.warn(
      "[email] EMAIL_REPLY_TO ausente — campanhas têm mais chance de ir para spam.",
    );
  }

  const client = getResendClient();
  if (!client) {
    return { ok: false, error: "Cliente de e-mail indisponível." };
  }

  const logoAttachment = getEmailLogoAttachmentForResend();
  const attachments = logoAttachment ? [logoAttachment] : undefined;
  const headers =
    kind === "marketing" ? buildMarketingEmailHeaders(to) : undefined;

  const { data, error } = await client.emails.send({
    from,
    to: [to],
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: replyTo ?? undefined,
    attachments,
    headers,
    tags: [
      { name: "category", value: input.category },
      { name: "app", value: "bolao-do-milhao" },
      { name: "kind", value: kind },
    ],
  });

  if (error) {
    console.error("[email] resend error", { message: error.message, name: error.name });
    return { ok: false, error: error.message || "Falha ao enviar e-mail." };
  }

  return { ok: true, id: data?.id ?? "unknown" };
}
