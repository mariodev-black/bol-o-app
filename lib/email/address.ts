import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Informe um e-mail válido.")
  .max(200, "E-mail muito longo.");

export type ParsedEmail = { ok: true; email: string } | { ok: false; error: string };

/** Normaliza e valida e-mail para envio transacional (Resend). */
export function parseTransactionalEmail(raw: string): ParsedEmail {
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Informe um e-mail válido.";
    return { ok: false, error: msg };
  }
  return { ok: true, email: parsed.data };
}

export function normalizeTransactionalEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
